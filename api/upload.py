from flask import request, jsonify
from vercel_blob import BlobServiceClient
import os

def upload_handler():
    if request.method == 'POST':
        blob_service_client = BlobServiceClient(
            account_url=os.environ.get("BLOB_READ_WRITE_TOKEN")
        )
        
        # Get signed upload URLs
        result = {}
        for file_type in ['csv_file', 'earth_fix', 'earth_nav']:
            filename = request.json.get(f'{file_type}_name')
            if filename:
                signed_url = blob_service_client.get_signed_url(
                    container_name="airway-generator",
                    blob_name=filename,
                    permissions="write",
                    expiry=3600  # 1 hour
                )
                result[file_type] = {
                    'url': signed_url,
                    'filename': filename
                }
                
        return jsonify(result)
    
    return jsonify({"error": "Method not allowed"}), 405 