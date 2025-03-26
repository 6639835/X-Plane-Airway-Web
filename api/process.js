// Vercel Serverless Function
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Get file info from request
    const { csv_file, earth_fix, earth_nav } = req.body;
    
    if (!csv_file || !earth_fix || !earth_nav) {
      return res.status(400).json({ error: 'Missing required file information' });
    }

    // Get Vercel Blob token
    const blob_token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blob_token) {
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN environment variable is not set' });
    }

    // Create a temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'airway-'));
    
    try {
      // Download each file
      const filePaths = {};
      for (const [fileType, fileInfo] of Object.entries({ csv_file, earth_fix, earth_nav })) {
        const { pathname, filename } = fileInfo;
        
        if (!pathname || !filename) {
          return res.status(400).json({ error: `Missing pathname or filename for ${fileType}` });
        }
        
        // Get download URL from Vercel Blob
        const response = await fetch(`https://blob.vercel-storage.com/${pathname}`, {
          headers: { 'Authorization': `Bearer ${blob_token}` }
        });
        
        if (!response.ok) {
          const text = await response.text();
          return res.status(response.status).json({ 
            error: `Failed to download ${filename}: ${text}` 
          });
        }
        
        // Save file locally
        const localPath = path.join(tempDir, filename);
        const buffer = await response.buffer();
        await fs.writeFile(localPath, buffer);
        
        filePaths[fileType] = localPath;
      }
      
      // Write a temporary Python script to process the files
      const scriptPath = path.join(tempDir, 'process.py');
      const scriptContent = `
import sys
import csv
import re
import os
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

def load_fixed_width_data(filepath, key_index, value_index, 
                         extra_condition_index=None, 
                         extra_condition_values=None,
                         type_index=None, 
                         type_value=None):
    """
    Load data from a fixed-width file into a dictionary.
    """
    data = {}
    try:
        with open(filepath, 'r', encoding='utf-8') as file:
            for line in file:
                parts = line.split()
                if len(parts) <= max(key_index, value_index):
                    continue
                    
                # Check conditions
                condition_met = True
                if extra_condition_index is not None and extra_condition_values is not None:
                    if len(parts) <= extra_condition_index or parts[extra_condition_index] not in extra_condition_values:
                        condition_met = False
                        
                if type_index is not None and type_value is not None:
                    if len(parts) <= type_index or parts[type_index] != type_value:
                        condition_met = False
                
                if condition_met:
                    data[parts[key_index]] = parts[value_index]
        return data
    except Exception as e:
        logging.error(f"Error loading data from {filepath}: {e}")
        return {}

def sort_key(line):
    """Extract sort key from a line based on the last component."""
    last_part = line.split()[-1]
    match = re.match(r"([A-Z]+)(\\d*)$", last_part)
    if match:
        letters, numbers = match.groups()
        numbers = int(numbers) if numbers else 0
        return (letters, numbers)
    return (last_part, float('inf'))

def convert_csv_to_dat(csv_file, earth_fix_path, earth_nav_path, output_file):
    """Convert navigation data from CSV format to X-Plane DAT format."""
    results = {
        "success": False,
        "message": "",
        "lines_written": 0,
        "skipped_rows": 0,
        "output_file": ""
    }
    
    # Validate input files
    for file_path, file_desc in [
        (csv_file, "CSV file"), 
        (earth_fix_path, "Earth fix file"), 
        (earth_nav_path, "Earth nav file")
    ]:
        if not os.path.exists(file_path):
            results["message"] = f"Error: {file_desc} not found: {file_path}"
            return results
    
    # Load reference data
    logging.info("Loading reference data...")
    earth_fix_data = load_fixed_width_data(
        earth_fix_path, 2, 4, 3, {"ENRT"}, 3, "ENRT"
    )
    earth_nav_data = load_fixed_width_data(
        earth_nav_path, 7, 9, 8, {"ENRT"}, 8, "ENRT"
    )
    
    if not earth_fix_data or not earth_nav_data:
        results["message"] = "Error: Failed to load reference data"
        return results
        
    logging.info(f"Loaded {len(earth_fix_data)} fix points and {len(earth_nav_data)} nav points")
    
    output_lines = []
    skipped_rows = 0

    try:
        with open(csv_file, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            rows = list(reader)
            
            for row in rows:
                # Start point processing
                first_part = row['CODE_POINT_START']
                
                if row['CODE_TYPE_START'] == 'DESIGNATED_POINT':
                    third_part = '11'
                    second_part = earth_fix_data.get(first_part)
                elif row['CODE_TYPE_START'] == 'VORDME':
                    third_part = '3'
                    second_part = earth_nav_data.get(first_part)
                else:  # Assuming VOR
                    third_part = '2'
                    second_part = earth_nav_data.get(first_part)

                if not second_part:
                    logging.warning(f"No area code found for start point {first_part}. Skipping row.")
                    skipped_rows += 1
                    continue

                # End point processing
                fourth_part = row['CODE_POINT_END']
                
                if row['CODE_TYPE_END'] == 'DESIGNATED_POINT':
                    sixth_part = '11'
                    fifth_part = earth_fix_data.get(fourth_part)
                elif row['CODE_TYPE_END'] == 'VORDME':
                    sixth_part = '3'
                    fifth_part = earth_nav_data.get(fourth_part)
                else:  # Assuming VOR
                    sixth_part = '2'
                    fifth_part = earth_nav_data.get(fourth_part)

                if not fifth_part:
                    logging.warning(f"No area code found for end point {fourth_part}. Skipping row.")
                    skipped_rows += 1
                    continue

                # Direction
                seventh_part = 'N' if row['CODE_DIR'] == 'X' else row['CODE_DIR']
                
                # Fixed values
                ninth_part = '0'
                tenth_part = '600'
                eleventh_part = row['TXT_DESIG']
                
                # Generate both directions of the airway
                for i in range(1, 3):
                    dat_line = (
                        f"{first_part:>5}{second_part:>3}{third_part:>3}{fourth_part:>6}"
                        f"{fifth_part:>3}{sixth_part:>3}{seventh_part:>2}{i:>2}{ninth_part:>4}"
                        f"{tenth_part:>4} {eleventh_part}\\n"
                    )
                    output_lines.append(dat_line)

        # Sort and write output
        output_lines.sort(key=sort_key)

        with open(output_file, 'w', encoding='utf-8') as datfile:
            datfile.writelines(output_lines)

        results["success"] = True
        results["lines_written"] = len(output_lines)
        results["skipped_rows"] = skipped_rows
        results["output_file"] = output_file
        results["message"] = f"Processing completed! Wrote {len(output_lines)} lines."
            
    except Exception as e:
        results["message"] = f"Error during processing: {e}"
        
    return results

if __name__ == "__main__":
    # Get command line arguments
    if len(sys.argv) != 5:
        print("Usage: python process.py <csv_file> <earth_fix_path> <earth_nav_path> <output_file>")
        sys.exit(1)
        
    csv_file = sys.argv[1]
    earth_fix_path = sys.argv[2]
    earth_nav_path = sys.argv[3]
    output_file = sys.argv[4]
    
    # Process the files
    result = convert_csv_to_dat(csv_file, earth_fix_path, earth_nav_path, output_file)
    
    # Print result as JSON for the parent process to parse
    print(f"OUTPUT_START:{result}:OUTPUT_END")
      `;
      
      await fs.writeFile(scriptPath, scriptContent);
      
      // Process the files using Python script
      const outputPath = path.join(tempDir, 'output.dat');
      const { stdout, stderr } = await execAsync(
        `python ${scriptPath} ${filePaths.csv_file} ${filePaths.earth_fix} ${filePaths.earth_nav} ${outputPath}`
      );
      
      // Parse the result from the Python script
      const resultMatch = stdout.match(/OUTPUT_START:(.*):OUTPUT_END/s);
      let result;
      
      if (resultMatch && resultMatch[1]) {
        try {
          result = JSON.parse(resultMatch[1].replace(/'/g, '"'));
        } catch (e) {
          return res.status(500).json({ 
            error: `Failed to parse process result: ${e.message}`, 
            stdout,
            stderr
          });
        }
      } else {
        return res.status(500).json({ 
          error: 'Failed to get process result',
          stdout,
          stderr
        });
      }
      
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      
      // Upload result to Vercel Blob
      const outputBlob = await fs.readFile(outputPath);
      const outputFilename = `airway_output_${path.basename(filePaths.csv_file, '.csv')}.dat`;
      const pathname = `airway-generator/${outputFilename}`;
      
      // Get upload URL
      const urlResponse = await fetch('https://blob.vercel-storage.com/upload/presigned-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${blob_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          'pathname': pathname,
          'contentType': 'application/octet-stream'
        })
      });
      
      if (!urlResponse.ok) {
        const text = await urlResponse.text();
        return res.status(urlResponse.status).json({ 
          error: `Failed to get upload URL: ${text}` 
        });
      }
      
      const urlData = await urlResponse.json();
      const uploadUrl = urlData.uploadUrl;
      
      // Upload file
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: outputBlob
      });
      
      if (!uploadResponse.ok) {
        const text = await uploadResponse.text();
        return res.status(uploadResponse.status).json({ 
          error: `Failed to upload result file: ${text}` 
        });
      }
      
      // Get download URL
      const downloadUrl = `https://blob.vercel-storage.com/${pathname}`;
      
      return res.status(200).json({
        success: true,
        lines_written: result.lines_written,
        skipped_rows: result.skipped_rows,
        download_url: downloadUrl,
        filename: outputFilename
      });
      
    } finally {
      // Clean up temporary files
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.error('Error cleaning up temporary files:', error);
      }
    }
  } catch (error) {
    console.error('Error processing files:', error);
    return res.status(500).json({ error: `Error processing files: ${error.message}` });
  }
} 