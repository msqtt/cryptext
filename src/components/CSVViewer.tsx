import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  LayoutGrid, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  RotateCcw,
  Check,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

// RFC 4180 Compliant CSV Parser
export function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  
  if (!text) return [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current);
        current = '';
      } else if (char === '\r' || char === '\n') {
        row.push(current);
        current = '';
        result.push(row);
        row = [];
        if (char === '\r' && next === '\n') {
          i++; // Skip LF of CRLF
        }
      } else {
        current += char;
      }
    }
  }
  
  if (current !== '' || row.length > 0) {
    row.push(current);
  }
  if (row.length > 0) {
    result.push(row);
  }

  // Normalize column count so all rows are uniform width
  const maxCols = Math.max(...result.map(r => r.length), 1);
  return result.map(row => {
    while (row.length < maxCols) {
      row.push('');
    }
    return row;
  });
}

// RFC 4180 Compliant CSV Stringifier
export function stringifyCSV(rows: string[][]): string {
  return rows.map(row => 
    row.map(cell => {
      const escaped = cell ?? '';
      if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('\r') || escaped.includes('"')) {
        return `"${escaped.replace(/"/g, '""')}"`;
      }
      return escaped;
    }).join(',')
  ).join('\n');
}

interface CSVViewerProps {
  value: string;
  onChange: (newValue: string) => void;
  theme: 'light' | 'dark' | 'system';
}

export const CSVViewer: React.FC<CSVViewerProps> = ({ value, onChange, theme }) => {
  const [data, setData] = useState<string[][]>([]);
  const [useFirstRowAsHeader, setUseFirstRowAsHeader] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Sorting
  const [sortColumnIndex, setSortColumnIndex] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Editing state
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Synchronize internal state on content changes
  useEffect(() => {
    const parsed = parseCSV(value);
    // If empty parsed but original value exists, initialize with at least blank grid
    if (parsed.length === 0) {
      setData([['', '']]);
    } else {
      setData(parsed);
    }
  }, [value]);

  // Convert column index to Spreadsheet letters: 0 -> A, 1 -> B, ..., 26 -> AA
  const getColLetter = (index: number): string => {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  // Derived headers
  const headers = useMemo(() => {
    if (data.length === 0) return [];
    
    const numCols = data[0].length;
    if (useFirstRowAsHeader && data.length > 0) {
      return data[0].map((cell, idx) => ({
        label: cell.trim() || `Column ${getColLetter(idx)}`,
        index: idx
      }));
    } else {
      return Array.from({ length: numCols }, (_, idx) => ({
        label: getColLetter(idx),
        index: idx
      }));
    }
  }, [data, useFirstRowAsHeader]);

  // Rows that are actually data (excluding header row if used)
  const contentRows = useMemo(() => {
    if (data.length === 0) return [];
    return useFirstRowAsHeader ? data.slice(1) : data;
  }, [data, useFirstRowAsHeader]);

  // Filter and Sort rows
  const preparedRows = useMemo(() => {
    let rowsWithOriginalIndex = contentRows.map((cols, idx) => ({
      cols,
      // Map back to absolute index in original data array
      originalIdx: useFirstRowAsHeader ? idx + 1 : idx
    }));

    // Local filter across all fields
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      rowsWithOriginalIndex = rowsWithOriginalIndex.filter(row => 
        row.cols.some(cell => cell.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortColumnIndex !== null) {
      rowsWithOriginalIndex.sort((a, b) => {
        const valA = a.cols[sortColumnIndex] || '';
        const valB = b.cols[sortColumnIndex] || '';
        
        // Try numeric sorting first
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }

        // Standard lexical sorting
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
          : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    return rowsWithOriginalIndex;
  }, [contentRows, searchQuery, sortColumnIndex, sortDirection, useFirstRowAsHeader]);

  // Paginated Rows
  const totalPages = Math.ceil(preparedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return preparedRows.slice(start, start + pageSize);
  }, [preparedRows, currentPage, pageSize]);

  // Safe page correction
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const triggerDataUpdate = (newData: string[][]) => {
    const csvString = stringifyCSV(newData);
    onChange(csvString);
  };

  // Handlers for grid manipulation
  const handleCellSave = (rowIndex: number, colIndex: number) => {
    if (!editingCell) return;
    const updated = [...data];
    updated[rowIndex][colIndex] = editingValue;
    setData(updated);
    triggerDataUpdate(updated);
    setEditingCell(null);
  };

  const startEditing = (rowIndex: number, colIndex: number, currentVal: string) => {
    setEditingCell({ rowIndex, colIndex });
    setEditingValue(currentVal);
  };

  const handleKeyPress = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (e.key === 'Enter') {
      handleCellSave(rowIndex, colIndex);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const handleAddRow = () => {
    const numCols = data.length > 0 ? data[0].length : 2;
    const newRow = Array(numCols).fill('');
    const updated = [...data, newRow];
    setData(updated);
    triggerDataUpdate(updated);
  };

  const handleDeleteRow = (absoluteIndex: number) => {
    if (data.length <= 1) return; // Retain at least 1 row
    
    // Check if we are deleting header
    if (absoluteIndex === 0 && useFirstRowAsHeader) {
      setUseFirstRowAsHeader(false);
    }

    const updated = data.filter((_, idx) => idx !== absoluteIndex);
    setData(updated);
    triggerDataUpdate(updated);
  };

  const handleAddColumn = () => {
    const updated = data.map(row => [...row, '']);
    setData(updated);
    triggerDataUpdate(updated);
  };

  const handleDeleteColumn = (colIndex: number) => {
    if (data.length === 0 || data[0].length <= 1) return; // Retain at least 1 column
    const updated = data.map(row => row.filter((_, idx) => idx !== colIndex));
    setData(updated);
    triggerDataUpdate(updated);
    
    if (sortColumnIndex === colIndex) {
      setSortColumnIndex(null);
    }
  };

  const handleSort = (colIndex: number) => {
    if (sortColumnIndex === colIndex) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumnIndex(null);
      }
    } else {
      setSortColumnIndex(colIndex);
      setSortDirection('asc');
    }
  };

  const handleExportCSV = () => {
    const blob = new Blob([value], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'exported_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#FAFAFC] dark:bg-[#0B0D10] text-[#1E2024] dark:text-[#E2E4E9]">
      {/* CSV Headers Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12151B] shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Interactive Grid View</span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 py-1.5 px-2.5 rounded-lg text-xs font-semibold select-none transition-colors border border-zinc-200 dark:border-zinc-800">
            <input 
              type="checkbox"
              checked={useFirstRowAsHeader}
              onChange={(e) => setUseFirstRowAsHeader(e.target.checked)}
              className="rounded dark:bg-zinc-950 border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
            />
            <span>First Row as Header</span>
          </label>
        </div>

        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold transition-colors"
            title="Add new row"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>
          
          <button
            onClick={handleAddColumn}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold transition-colors"
            title="Add new column"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Col</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-700 dark:hover:bg-indigo-600 border border-transparent rounded-lg text-xs font-semibold transition-colors"
            title="Download CSV file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* SEARCH & STATS PANEL */}
      <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-850 bg-[#F4F5F8] dark:bg-[#0E1116] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-white dark:bg-[#161A22] border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-5 text-xs text-zinc-500 dark:text-gray-400 font-medium">
          <div>
            Total Matrix: <span className="font-semibold text-zinc-800 dark:text-[#E0E0E0]">{data.length}r × {data[0]?.length || 0}c</span>
          </div>
          {searchQuery && (
            <div>
              Search Match: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{preparedRows.length} results</span>
            </div>
          )}
        </div>
      </div>

      {/* SPREADSHEET TABLE SURFACE */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full border-separate border-spacing-0 text-left text-xs font-medium table-fixed">
          <thead className="sticky top-0 z-10 bg-zinc-100 dark:bg-[#151921] shadow-sm select-none">
            <tr>
              {/* Corner Row-Index Header */}
              <th className="w-12 border-b border-r border-zinc-200 dark:border-zinc-800 bg-[#E8EAEF] dark:bg-[#1A1F2A] px-2 py-2 text-center text-[10px] text-zinc-500 font-mono tracking-wider font-bold">
                #
              </th>

              {/* Dynamic Columns Headers */}
              {headers.map((h, hIdx) => (
                <th 
                  key={h.index} 
                  className="group min-w-[120px] max-w-[280px] border-b border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121620] px-3 py-2 text-zinc-600 dark:text-[#9DA5B4] font-semibold relative transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-[#191D29]"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span 
                      onClick={() => handleSort(h.index)}
                      className="truncate cursor-pointer flex-1 select-none pr-1 uppercase tracking-wider text-[10px] flex items-center gap-1"
                      title="Click to sort column"
                    >
                      {h.label}
                      {sortColumnIndex === h.index ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-indigo-500 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeleteColumn(h.index)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-red-500 transition-all rounded"
                      title="Delete this column"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((rowItem, rIdx) => {
              const absRowIndex = rowItem.originalIdx;
              return (
                <tr 
                  key={absRowIndex}
                  className="bg-white dark:bg-[#0E1116] hover:bg-zinc-50 dark:hover:bg-[#141822]/40 transition-colors group"
                >
                  {/* Row Indicator with absolute delete row options */}
                  <td className="border-b border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#11141C]/30 text-center font-mono text-[10px] text-zinc-400 dark:text-gray-500 font-semibold py-1.5 select-none relative">
                    <span className="group-hover:hidden">{absRowIndex}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(absRowIndex)}
                      className="hidden group-hover:inline-flex items-center justify-center p-0.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded absolute inset-0 m-auto w-5 h-5 transition-colors"
                      title={`Delete Row ${absRowIndex}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>

                  {/* Cell Blocks */}
                  {rowItem.cols.map((cell, cIdx) => {
                    const isEditing = editingCell?.rowIndex === absRowIndex && editingCell?.colIndex === cIdx;
                    return (
                      <td 
                        key={cIdx}
                        className="border-b border-r border-zinc-200 dark:border-zinc-850 px-2 py-1.5 relative select-text"
                        onDoubleClick={() => startEditing(absRowIndex, cIdx, cell)}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1 absolute inset-0 p-0.5 z-20 bg-white dark:bg-[#121620]">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => handleKeyPress(e, absRowIndex, cIdx)}
                              className="flex-1 w-full bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold px-1.5 h-full rounded border border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-900 dark:text-white"
                              autoFocus
                            />
                            <button
                              onClick={() => handleCellSave(absRowIndex, cIdx)}
                              className="p-1 bg-green-500 hover:bg-green-600 text-white rounded shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCell(null)}
                              className="p-1 bg-zinc-200 text-zinc-650 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 rounded shadow-sm"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            className="truncate text-zinc-800 dark:text-[#D1D5DB] min-h-[1.25rem] pr-6 cursor-pointer tracking-normal select-none"
                            title="Double click to edit cell content"
                          >
                            {cell === '' ? (
                              <span className="text-zinc-350 dark:text-zinc-700 italic select-none">empty</span>
                            ) : (
                              highlightText(cell, searchQuery)
                            )}
                          </div>
                        )}
                        
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => startEditing(absRowIndex, cIdx, cell)}
                            className="absolute right-1 top-2.5 opacity-0 group-hover:opacity-100 p-0.5 text-zinc-350 hover:text-indigo-500 rounded transition-all select-none"
                            title="Edit cell"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {paginatedRows.length === 0 && (
              <tr>
                <td colSpan={(data[0]?.length || 0) + 1} className="py-12 text-center text-zinc-400 dark:text-zinc-650 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <FileText className="w-8 h-8 opacity-40 mb-2" />
                    <p className="font-semibold text-xs">No matching records found</p>
                    <p className="text-[10px]">Change your query or add rows to get started.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER PAGINATION BAR */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12151B] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-gray-400">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-zinc-800 text-xs font-semibold rounded-md px-2 py-1 outline-none text-zinc-700 dark:text-zinc-300"
          >
            {[10, 25, 50, 100].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span className="text-xs text-zinc-400 font-medium">
            Showing {preparedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, preparedRows.length)} of {preparedRows.length} rows
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-1 px-2.5 bg-zinc-50 hover:bg-zinc-100 disabled:opacity-45 disabled:pointer-events-none dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Prev</span>
          </button>

          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold px-2">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="p-1 px-2.5 bg-zinc-50 hover:bg-zinc-100 disabled:opacity-45 disabled:pointer-events-none dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function to highlight text matches in the cell
function highlightText(text: string, highlight: string) {
  if (!highlight.trim()) {
    return <span>{text}</span>;
  }
  const parts = text.split(new RegExp(`(${escapeRegExp(highlight)})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100 px-0.5 rounded-sm line-clamp-1 py-0 font-bold">{part}</mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
