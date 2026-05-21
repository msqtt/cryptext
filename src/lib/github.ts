import { Octokit } from 'octokit';
import { encryptFileName, decryptFileName, encryptLine } from './crypto';

export interface GithubConfig {
  githubToken: string;
  repoUrl: string;
  filePath: string;
  branch: string;
  encryptionKey?: string;
}

export function parseRepoInfo(repoUrl: string) {
  if (!repoUrl) return { owner: '', repo: '' };
  
  // Handle github.com/owner/repo format
  let match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  // Handle owner/repo format
  const parts = repoUrl.split('/');
  if (parts.length === 2 && !repoUrl.includes('http')) {
    return { owner: parts[0], repo: parts[1] };
  }
  
  return { owner: '', repo: '' };
}

export async function fetchFileFromGithub(config: GithubConfig): Promise<{ content: string; sha: string } | null> {
  const { githubToken, repoUrl, filePath, branch, encryptionKey } = config;
  const { owner: repoOwner, repo: repoName } = parseRepoInfo(repoUrl);
  
  if (!githubToken || !repoOwner || !repoName || !filePath) return null;

  const actualPath = encryptionKey ? encryptFileName(filePath, encryptionKey) : filePath;

  const octokit = new Octokit({ auth: githubToken });

  try {
    const response = await octokit.rest.repos.getContent({
      owner: repoOwner,
      repo: repoName,
      path: actualPath,
      ref: branch || 'main',
    });

    if (Array.isArray(response.data)) {
      throw new Error('Path is a directory, not a file');
    }

    if (response.data.type === 'file' && response.data.content) {
      // Content is base64 encoded by GitHub, and since it's just Base85 strings + \n, 
      // we can use atob directly without UTF-8 conversions.
      const decodedContent = atob(response.data.content);
      return { content: decodedContent, sha: response.data.sha };
    }
    
    return null;
  } catch (error: any) {
    if (error.status === 404) {
      return null; // File doesn't exist yet
    }
    throw error;
  }
}

export async function saveFileToGithub(
  config: GithubConfig,
  content: string,
  sha: string | null,
  message: string = 'Update encrypted notes'
): Promise<string> {
  const { githubToken, repoUrl, filePath, branch, encryptionKey } = config;
  const { owner: repoOwner, repo: repoName } = parseRepoInfo(repoUrl);

  if (!githubToken || !repoOwner || !repoName || !filePath) {
    throw new Error('Missing GitHub configuration');
  }

  const actualPath = encryptionKey ? encryptFileName(filePath, encryptionKey) : filePath;

  const octokit = new Octokit({ auth: githubToken });

  // Convert content to Base64 (supporting UTF-8 if it is not encrypted)
  const utf8Bytes = new TextEncoder().encode(content);
  let binary = '';
  for (let i = 0; i < utf8Bytes.byteLength; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  const base64Content = btoa(binary);

  const params: any = {
    owner: repoOwner,
    repo: repoName,
    path: actualPath,
    message,
    content: base64Content,
    branch: branch || 'main',
  };

  if (sha) {
    params.sha = sha;
  }

  const response = await octokit.rest.repos.createOrUpdateFileContents(params);
  
  return response.data.content!.sha;
}

export async function commitMultipleChanges(
  config: GithubConfig,
  changes: Record<string, { type: 'write'; content?: string; sha?: string } | { type: 'delete' }>
): Promise<void> {
  const { githubToken, repoUrl, branch, encryptionKey } = config;
  const { owner: repoOwner, repo: repoName } = parseRepoInfo(repoUrl);
  if (!githubToken || !repoOwner || !repoName) throw new Error("Missing GitHub configuration");

  const octokit = new Octokit({ auth: githubToken });

  // 1. Get current commit
  const refRes = await octokit.rest.git.getRef({
    owner: repoOwner,
    repo: repoName,
    ref: `heads/${branch || 'main'}`
  });
  const currentCommitSha = refRes.data.object.sha;

  // 2. Get current commit details
  const commitRes = await octokit.rest.git.getCommit({
    owner: repoOwner,
    repo: repoName,
    commit_sha: currentCommitSha
  });
  const baseTreeSha = commitRes.data.tree.sha;

  // Fetch base tree to verify if files to delete actually exist
  const baseTreeRes = await octokit.rest.git.getTree({
    owner: repoOwner,
    repo: repoName,
    tree_sha: baseTreeSha,
    recursive: "1"
  });
  const existingPaths = new Set(baseTreeRes.data.tree.map((t: any) => t.path));

  // 3. Create blobs and build tree items
  const treeItems: any[] = [];
  const paths = Object.keys(changes);
  let actionStr = "";
  
  if (paths.length === 1) {
    const p = paths[0];
    const c = changes[p];
    actionStr = `${c.type === 'write' ? 'Update' : 'Delete'} ${p}`;
  } else {
    actionStr = `Update ${paths.length} files`;
  }

  for (const [path, change] of Object.entries(changes)) {
    const actualPath = encryptionKey ? encryptFileName(path, encryptionKey) : path;
    
    if (change.type === 'delete') {
      if (existingPaths.has(actualPath)) {
        treeItems.push({
          path: actualPath,
          mode: '100644',
          type: 'blob',
          sha: null // setting sha to null deletes the file in the new tree
        });
      }
    } else {
      let finalSha = change.sha;
      if (!finalSha && change.content !== undefined) {
        let contentToSave = change.content;
        if (encryptionKey && path !== '.vimrc') {
          const lines = contentToSave.split('\n');
          contentToSave = lines.map(line => {
            if (!line.trim()) return '';
            try {
              return encryptLine(line, encryptionKey);
            } catch(e) {
              return line;
            }
          }).join('\n');
        }
        
        // Create blob (Base64) - properly encoding UTF-8 string to base64
        const utf8Bytes = new TextEncoder().encode(contentToSave);
        let binary = '';
        for (let i = 0; i < utf8Bytes.byteLength; i++) {
          binary += String.fromCharCode(utf8Bytes[i]);
        }
        const base64Content = btoa(binary);
        
        const blobRes = await octokit.rest.git.createBlob({
          owner: repoOwner,
          repo: repoName,
          content: base64Content,
          encoding: 'base64'
        });
        finalSha = blobRes.data.sha;
      }
      
      if (finalSha) {
        treeItems.push({
          path: actualPath,
          mode: '100644',
          type: 'blob',
          sha: finalSha
        });
      }
    }
  }

  // 4. Create new tree
  const treeRes = await octokit.rest.git.createTree({
    owner: repoOwner,
    repo: repoName,
    base_tree: baseTreeSha,
    tree: treeItems
  });

  // 5. Create new commit
  const newCommitRes = await octokit.rest.git.createCommit({
    owner: repoOwner,
    repo: repoName,
    message: actionStr,
    tree: treeRes.data.sha,
    parents: [currentCommitSha]
  });

  // 6. Update ref
  await octokit.rest.git.updateRef({
    owner: repoOwner,
    repo: repoName,
    ref: `heads/${branch || 'main'}`,
    sha: newCommitRes.data.sha
  });
}


export async function getRepoTree(config: GithubConfig): Promise<any[]> {
  const { githubToken, repoUrl, branch, encryptionKey } = config;
  const { owner: repoOwner, repo: repoName } = parseRepoInfo(repoUrl);
  if (!githubToken || !repoOwner || !repoName) return [];
  const octokit = new Octokit({ auth: githubToken });
  try {
    const res = await octokit.rest.git.getTree({
      owner: repoOwner,
      repo: repoName,
      tree_sha: branch || 'main',
      recursive: 'true',
    });
    
    if (encryptionKey && res.data.tree) {
      return res.data.tree.map((item: any) => {
        if (!item.path) return item;
        return {
          ...item,
          path: decryptFileName(item.path, encryptionKey)
        };
      });
    }

    return res.data.tree;
  } catch (e: any) {
    if (e.status === 404 || e.status === 409) return [];
    throw e;
  }
}

export async function getFileHistory(config: GithubConfig, repoLevelHistory = false): Promise<any[]> {
  const { githubToken, repoUrl, filePath, branch, encryptionKey } = config;
  const { owner: repoOwner, repo: repoName } = parseRepoInfo(repoUrl);
  if (!githubToken || !repoOwner || !repoName) return [];

  const octokit = new Octokit({ auth: githubToken });
  const params: any = {
    owner: repoOwner,
    repo: repoName,
    sha: branch || 'main',
  };

  if (filePath && !repoLevelHistory) {
    params.path = encryptionKey ? encryptFileName(filePath, encryptionKey) : filePath;
  }

  try {
    const res = await octokit.rest.repos.listCommits(params);
    return res.data;
  } catch (e: any) {
    if (e.status === 404) return [];
    throw e;
  }
}


export async function fetchFileVersion(config: GithubConfig, ref: string): Promise<{ content: string; sha: string } | null> {
  const { githubToken, repoUrl, filePath, encryptionKey } = config;
  const { owner: repoOwner, repo: repoName } = parseRepoInfo(repoUrl);
  if (!filePath) return null;
  const octokit = new Octokit({ auth: githubToken });

  const actualPath = encryptionKey ? encryptFileName(filePath, encryptionKey) : filePath;

  try {
    const response = await octokit.rest.repos.getContent({
      owner: repoOwner,
      repo: repoName,
      path: actualPath,
      ref,
    });

    if (Array.isArray(response.data)) {
      throw new Error('Path is a directory, not a file');
    }

    if (response.data.type === 'file' && response.data.content) {
      const decodedContent = atob(response.data.content);
      return { content: decodedContent, sha: response.data.sha };
    }
    
    return null;
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getBlobContent(config: GithubConfig, fileSha: string): Promise<string | null> {
  const { githubToken, repoUrl } = config;
  const { owner: repoOwner, repo: repoName } = parseRepoInfo(repoUrl);
  if (!githubToken || !repoOwner || !repoName || !fileSha) return null;

  const octokit = new Octokit({ auth: githubToken });
  try {
    const res = await octokit.rest.git.getBlob({
      owner: repoOwner,
      repo: repoName,
      file_sha: fileSha
    });
    const b64 = res.data.content;
    const binary = atob(b64);
    try {
      return decodeURIComponent(escape(binary));
    } catch {
      return binary;
    }
  } catch (e: any) {
    if (e.status === 404) return null;
    throw e;
  }
}
