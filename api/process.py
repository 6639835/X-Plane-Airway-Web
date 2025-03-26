from flask import request, jsonify
import os
import tempfile
import csv
import re
import logging
import requests
from typing import Dict, List, Optional, Set

# Import your conversion functions
from app import load_fixed_width_data, sort_key, convert_csv_to_dat

def process_handler():
    if request.method == 'POST':
        try:
            # Get file info from request
            files = request.json
            blob_token = os.environ.get("BLOB_READ_WRITE_TOKEN")
            
            if not blob_token:
                return jsonify({"error": "BLOB_READ_WRITE_TOKEN environment variable is not set"}), 500
            
            # Download files to temporary location
            with tempfile.TemporaryDirectory() as temp_dir:
                # Download each file
                file_paths = {}
                for file_type, file_info in files.items():
                    pathname = file_info.get('pathname')
                    filename = file_info.get('filename')
                    local_path = os.path.join(temp_dir, filename)
                    
                    # Get download URL from Vercel Blob
                    response = requests.get(
                        f"https://blob.vercel-storage.com/{pathname}",
                        headers={"Authorization": f"Bearer {blob_token}"}
                    )
                    
                    if response.status_code != 200:
                        return jsonify({"error": f"Failed to download {filename}: {response.text}"}), 500
                    
                    # Save file locally
                    with open(local_path, 'wb') as f:
                        f.write(response.content)
                    
                    file_paths[file_type] = local_path
                
                # Process the files
                output_file = os.path.join(temp_dir, "output.dat")
                result = convert_csv_to_dat(
                    file_paths['csv_file'],
                    file_paths['earth_fix'],
                    file_paths['earth_nav'],
                    output_file
                )
                
                if not result["success"]:
                    return jsonify({"error": result["message"]}), 400
                
                # Upload result to Vercel Blob
                output_blob_name = f"airway_output_{os.path.splitext(os.path.basename(file_paths['csv_file']))[0]}.dat"
                pathname = f"airway-generator/{output_blob_name}"
                
                # Get upload URL
                url_response = requests.post(
                    "https://blob.vercel-storage.com/upload/presigned-url",
                    headers={
                        "Authorization": f"Bearer {blob_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "pathname": pathname,
                        "contentType": "application/octet-stream"
                    }
                )
                
                if url_response.status_code != 200:
                    return jsonify({"error": f"Failed to get upload URL: {url_response.text}"}), 500
                
                url_data = url_response.json()
                upload_url = url_data.get('uploadUrl')
                
                # Upload file
                with open(output_file, 'rb') as f:
                    upload_response = requests.put(
                        upload_url,
                        headers={"Content-Type": "application/octet-stream"},
                        data=f
                    )
                
                if upload_response.status_code not in (200, 201):
                    return jsonify({"error": f"Failed to upload result file: {upload_response.text}"}), 500
                
                # Get download URL
                download_url = f"https://blob.vercel-storage.com/{pathname}"
                
                return jsonify({
                    "success": True,
                    "lines_written": result["lines_written"],
                    "skipped_rows": result["skipped_rows"],
                    "download_url": download_url,
                    "filename": output_blob_name
                })
                
        except Exception as e:
            logging.error(f"Error processing files: {str(e)}")
            return jsonify({"error": f"Error processing files: {str(e)}"}), 500
    
    return jsonify({"error": "Method not allowed"}), 405 