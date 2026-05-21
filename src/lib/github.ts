import { Octokit } from 'octokit';
import { encryptFileName, decryptFileName } from './crypto';

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

  // Convert content to Base64 (content is guaranteed ASCII because it's Base85 + \n)
  const base64Content = btoa(content);

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
      treeItems.push({
        path: actualPath,
        mode: '100644',
        type: 'blob',
        sha: null // setting sha to null deletes the file in the new tree
      });
    } else {
      let finalSha = change.sha;
      if (!finalSha && change.content !== undefined) {
        // Create blob (Base64)
        const base64Content = btoa(change.content);
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

export async function deletePathFromGithub(
  config: GithubConfig,
  pathToDelete: string,
  isDirectory: boolean
): Promise<void> {
  const { githubToken, repoUrl, branch, encryptionKey } = config;
  const { owner: repoOwner, repo: repoName } = parseRepoInfo(repoUrl);
  if (!githubToken || !repoOwner || !repoName) return;

  const octokit = new Octokit({ auth: githubToken });

  if (isDirectory) {
    const tree = await getRepoTree(config);
    const prefix = pathToDelete + '/';
    const filesToDelete = tree.filter(item => item.type === 'blob' && item.path?.startsWith(prefix));
    
    for (const file of filesToDelete) {
      if (!file.path) continue;
      const actualPath = encryptionKey ? encryptFileName(file.path, encryptionKey) : file.path;
      try {
        const fileRes = await octokit.rest.repos.getContent({
          owner: repoOwner,
          repo: repoName,
          path: actualPath,
          ref: branch || 'main'
        });
        if (!Array.isArray(fileRes.data)) {
          await octokit.rest.repos.deleteFile({
            owner: repoOwner,
            repo: repoName,
            path: actualPath,
            message: `Delete ${file.path}`,
            sha: fileRes.data.sha,
            branch: branch || 'main'
          });
        }
      } catch(e) {
        console.error("Error deleting", file.path, e);
      }
    }
  } else {
    const actualPath = encryptionKey ? encryptFileName(pathToDelete, encryptionKey) : pathToDelete;
    try {
      const res = await octokit.rest.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: actualPath,
        ref: branch || 'main'
      });
      if (!Array.isArray(res.data) && res.data.type === 'file') {
        await octokit.rest.repos.deleteFile({
          owner: repoOwner,
          repo: repoName,
          path: actualPath,
          message: `Delete ${pathToDelete}`,
          sha: res.data.sha,
          branch: branch || 'main'
        });
      }
    } catch (e: any) {
      if (e.status !== 404) throw e;
    }
  }
}

export async function renamePathInGithub(
  config: GithubConfig,
  oldPath: string,
  newPath: string,
  isDirectory: boolean
): Promise<void> {
  const { githubToken, repoUrl, branch, encryptionKey } = config;
  const { owner: repoOwner, repo: repoName } = parseRepoInfo(repoUrl);
  if (!githubToken || !repoOwner || !repoName) return;

  const octokit = new Octokit({ auth: githubToken });

  if (isDirectory) {
    // Get entire tree to find all files starting with oldPath
    const tree = await getRepoTree(config);
    const prefix = oldPath + '/';
    const filesToMove = tree.filter(item => item.type === 'blob' && item.path?.startsWith(prefix));
    
    for (const file of filesToMove) {
      if (!file.path) continue;
      const oldFilePath = file.path;
      const newFilePath = newPath + '/' + oldFilePath.substring(prefix.length);
      
      // Get content of old file
      const oldActualPath = encryptionKey ? encryptFileName(oldFilePath, encryptionKey) : oldFilePath;
      const newActualPath = encryptionKey ? encryptFileName(newFilePath, encryptionKey) : newFilePath;
      
      try {
        const fileRes = await octokit.rest.repos.getContent({
          owner: repoOwner,
          repo: repoName,
          path: oldActualPath,
          ref: branch || 'main'
        });
        
        const fileData = fileRes.data as any;
        if (!Array.isArray(fileRes.data) && fileData.content) {
          // create new file
          await octokit.rest.repos.createOrUpdateFileContents({
            owner: repoOwner,
            repo: repoName,
            path: newActualPath,
            message: `Rename ${oldFilePath} to ${newFilePath}`,
            content: fileData.content, // already base64
            branch: branch || 'main'
          });
          
          // delete old file
          await octokit.rest.repos.deleteFile({
            owner: repoOwner,
            repo: repoName,
            path: oldActualPath,
            message: `Delete old ${oldFilePath}`,
            sha: fileData.sha,
            branch: branch || 'main'
          });
        }
      } catch(e) {
        console.error("Error moving file", oldFilePath, e);
      }
    }
  } else {
    // Single file
    const oldActualPath = encryptionKey ? encryptFileName(oldPath, encryptionKey) : oldPath;
    const newActualPath = encryptionKey ? encryptFileName(newPath, encryptionKey) : newPath;
    
    try {
      const fileRes = await octokit.rest.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: oldActualPath,
        ref: branch || 'main'
      });
      
      const fileData = fileRes.data as any;
      if (!Array.isArray(fileRes.data) && fileData.content) {
        // create new file
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: repoOwner,
          repo: repoName,
          path: newActualPath,
          message: `Rename ${oldPath} to ${newPath}`,
          content: fileData.content,
          branch: branch || 'main'
        });
        
        // delete old file
        await octokit.rest.repos.deleteFile({
          owner: repoOwner,
          repo: repoName,
          path: oldActualPath,
          message: `Delete old ${oldPath}`,
          sha: fileData.sha,
          branch: branch || 'main'
        });
      }
    } catch(e) {
      console.error("Error renaming file", oldPath, e);
    }
  }
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
