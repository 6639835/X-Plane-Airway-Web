from flask import request, jsonify
from vercel_blob import BlobServiceClient
import os
import tempfile
import csv
import re
import logging
from typing import Dict, List, Optional, Set

# Import your conversion functions
from app import load_fixed_width_data, sort_key, convert_csv_to_dat

def process_handler():
    if request.method == 'POST':
        try:
            # Get file URLs from request
            files = request.json
            
            # Create BlobServiceClient
            blob_service_client = BlobServiceClient(
                account_url=os.environ.get("BLOB_READ_WRITE_TOKEN")
            )
            
            # Download files to temporary location
            with tempfile.TemporaryDirectory() as temp_dir:
                # Download each file
                file_paths = {}
                for file_type, file_info in files.items():
                    blob_name = file_info['filename']
                    local_path = os.path.join(temp_dir, blob_name)
                    
                    # Download blob
                    blob_data = blob_service_client.download_blob(
                        container_name="airway-generator",
                        blob_name=blob_name
                    )
                    
                    with open(local_path, 'wb') as f:
                        f.write(blob_data)
                    
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
                
                # Upload result to blob storage
                with open(output_file, 'rb') as f:
                    output_content = f.read()
                
                output_blob_name = f"airway_output_{os.path.splitext(os.path.basename(file_paths['csv_file']))[0]}.dat"
                upload_result = blob_service_client.upload_blob(
                    container_name="airway-generator",
                    blob_name=output_blob_name,
                    data=output_content
                )
                
                # Get download URL
                download_url = blob_service_client.get_signed_url(
                    container_name="airway-generator",
                    blob_name=output_blob_name,
                    permissions="read",
                    expiry=86400  # 24 hours
                )
                
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