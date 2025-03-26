from flask import request, jsonify
import os
import requests
import time
import json
import hmac
import hashlib
import base64

def upload_handler():
    if request.method == 'POST':
        try:
            # Get Vercel Blob token
            blob_token = os.environ.get("BLOB_READ_WRITE_TOKEN")
            if not blob_token:
                return jsonify({"error": "BLOB_READ_WRITE_TOKEN environment variable is not set"}), 500
            
            # Parse token to get payload
            token_parts = blob_token.split('_')
            if len(token_parts) < 2:
                return jsonify({"error": "Invalid BLOB_READ_WRITE_TOKEN format"}), 500
                
            # Get file info from request
            file_info = request.json
            
            # Create signed URLs for each file
            result = {}
            for file_type in ['csv_file', 'earth_fix', 'earth_nav']:
                filename = file_info.get(f'{file_type}_name')
                if filename:
                    # Create a signed upload URL using Vercel Blob API
                    body = {
                        "pathname": f"airway-generator/{filename}",
                        "contentType": "application/octet-stream"
                    }
                    
                    response = requests.post(
                        "https://blob.vercel-storage.com/upload/presigned-url",
                        headers={
                            "Authorization": f"Bearer {blob_token}",
                            "Content-Type": "application/json"
                        },
                        json=body
                    )
                    
                    if response.status_code != 200:
                        return jsonify({"error": f"Failed to get upload URL: {response.text}"}), 500
                    
                    url_data = response.json()
                    
                    result[file_type] = {
                        'url': url_data.get('uploadUrl'),
                        'pathname': url_data.get('pathname'),
                        'filename': filename
                    }
                    
            return jsonify(result)
            
        except Exception as e:
            return jsonify({"error": f"Error generating upload URLs: {str(e)}"}), 500
    
    return jsonify({"error": "Method not allowed"}), 405 