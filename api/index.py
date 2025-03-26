from upload import upload_handler
from process import process_handler

# Map handlers to HTTP methods
def handler(request):
    path = request.path.split('/')[-1]
    
    if path == 'upload':
        return upload_handler()
    elif path == 'process':
        return process_handler()
    else:
        return {"error": "Not found"}, 404 