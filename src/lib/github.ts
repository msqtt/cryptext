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
        
        if (!Array.isArray(fileRes.data) && fileRes.data.content) {
          // create new file
          await octokit.rest.repos.createOrUpdateFileContents({
            owner: repoOwner,
            repo: repoName,
            path: newActualPath,
            message: `Rename ${oldFilePath} to ${newFilePath}`,
            content: fileRes.data.content, // already base64
            branch: branch || 'main'
          });
          
          // delete old file
          await octokit.rest.repos.deleteFile({
            owner: repoOwner,
            repo: repoName,
            path: oldActualPath,
            message: `Delete old ${oldFilePath}`,
            sha: fileRes.data.sha,
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
      
      if (!Array.isArray(fileRes.data) && fileRes.data.content) {
        // create new file
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: repoOwner,
          repo: repoName,
          path: newActualPath,
          message: `Rename ${oldPath} to ${newPath}`,
          content: fileRes.data.content,
          branch: branch || 'main'
        });
        
        // delete old file
        await octokit.rest.repos.deleteFile({
          owner: repoOwner,
          repo: repoName,
          path: oldActualPath,
          message: `Delete old ${oldPath}`,
          sha: fileRes.data.sha,
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

export async function getFileHistory(config: GithubConfig): Promise<any[]> {
  const { githubToken, repoUrl, filePath, branch, encryptionKey } = config;
  const { owner: repoOwner, repo: repoName } = parseRepoInfo(repoUrl);
  if (!githubToken || !repoOwner || !repoName || !filePath) return [];

  const actualPath = encryptionKey ? encryptFileName(filePath, encryptionKey) : filePath;

  const octokit = new Octokit({ auth: githubToken });

  try {
    const res = await octokit.rest.repos.listCommits({
      owner: repoOwner,
      repo: repoName,
      path: actualPath,
      sha: branch || 'main',
    });
    return res.data;
  } catch (e: any) {
    if (e.status === 404) return [];
    throw e;
  }
}

export async function fetchFileVersion(config: GithubConfig, ref: string): Promise<{ content: string; sha: string } | null> {
  const { githubToken, repoUrl, filePath, encryptionKey } = config;
  const { owner: repoOwner, repo: repoName } = parseRepoInfo(repoUrl);
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
