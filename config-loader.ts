import { readFileSync, existsSync } from 'fs';
import path from 'path';

export interface WikiConfig {
  wikiName: string;
  port: number;
  imagesDir: string;
  versionsDir: string;
  dataFile: string;
  tempDir: string;
}

export function loadConfig(configPath: string): WikiConfig {
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    
    // Resolve paths relative to the directory of the config file
    const configDir = path.dirname(path.resolve(configPath));
    
    return {
      wikiName: config.wikiName || 'DefaultWiki',
      port: config.port || 3000,
      imagesDir: path.resolve(configDir, config.imagesDir || 'images'),
      versionsDir: path.resolve(configDir, config.versionsDir || 'versions'),
      dataFile: path.resolve(configDir, config.dataFile || 'wiki_storage.json'),
      tempDir: path.resolve(configDir, config.tempDir || 'temp'),
    };
  }

  // Fallback to default behavior
  const cwd = process.cwd();
  return {
    wikiName: 'DefaultWiki',
    port: 3000,
    imagesDir: path.resolve(cwd, 'images'),
    versionsDir: path.resolve(cwd, 'versions'),
    dataFile: path.resolve(cwd, 'wiki_storage.json'),
    tempDir: path.resolve(cwd, 'temp'),
  };
}
