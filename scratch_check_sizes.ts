import fs from 'fs';
import { decryptJson } from './src/lib/crypto';
import { StorytelClient } from './src/lib/storytel/client';

async function main() {
  const enc = fs.readFileSync('.data/session.enc', 'utf8');
  const session = decryptJson<any>(enc);
  const client = new StorytelClient(session);

  // Test 1: Audio stream for 46420 (Think of a Number)
  console.log('Testing audio stream size for 46420...');
  try {
    const audioUrl = await client.getAudioStreamUrl('46420');
    const audioHead = await fetch(audioUrl, { method: 'HEAD' });
    const audioCl = audioHead.headers.get('content-length');
    console.log('Audio content-length:', audioCl, 'bytes =>', (Number(audioCl) / 1024 / 1024).toFixed(1), 'MB');
  } catch (e: any) {
    console.log('Audio error:', e.message);
  }

  // Test 2: Ebook for 1184672
  console.log('\nTesting ebook size for 1184672...');
  try {
    const ebookUrl = await client.getEbookDownloadUrl('1184672');
    const ebookHead = await fetch(ebookUrl, { method: 'HEAD' });
    const ebookCl = ebookHead.headers.get('content-length');
    console.log('Ebook content-length:', ebookCl, 'bytes =>', (Number(ebookCl) / 1024 / 1024).toFixed(1), 'MB');
  } catch (e: any) {
    console.log('Ebook error:', e.message);
  }
}

main().catch(console.error);
