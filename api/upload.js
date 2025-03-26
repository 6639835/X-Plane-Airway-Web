// Vercel Serverless Function
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { csv_file_name, earth_fix_name, earth_nav_name } = req.body;
    
    if (!csv_file_name || !earth_fix_name || !earth_nav_name) {
      return res.status(400).json({ error: 'Missing required file names' });
    }

    // Get Vercel Blob token
    const blob_token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blob_token) {
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN environment variable is not set' });
    }

    // Create signed URLs for each file
    const result = {};
    for (const [fileType, fileName] of [
      ['csv_file', csv_file_name],
      ['earth_fix', earth_fix_name],
      ['earth_nav', earth_nav_name]
    ]) {
      // Create a signed upload URL using Vercel Blob API
      const response = await fetch('https://blob.vercel-storage.com/upload/presigned-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${blob_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          'pathname': `airway-generator/${fileName}`,
          'contentType': 'application/octet-stream'
        })
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ 
          error: `Failed to get upload URL: ${text}` 
        });
      }

      const data = await response.json();
      
      result[fileType] = {
        'url': data.uploadUrl,
        'pathname': data.pathname,
        'filename': fileName
      };
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error generating upload URLs:', error);
    return res.status(500).json({ error: `Error generating upload URLs: ${error.message}` });
  }
} 