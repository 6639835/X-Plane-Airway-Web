from flask import Flask, request, jsonify
from .upload import upload_handler
from .process import process_handler

app = Flask(__name__)

@app.route('/api/upload', methods=['POST'])
def upload_api():
    return upload_handler()

@app.route('/api/process', methods=['POST'])
def process_api():
    return process_handler()

# For Vercel serverless function
def handler(http_request):
    with app.request_context(http_request):
        return app.full_dispatch_request() 