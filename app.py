import os
from flask import Flask, render_template, flash, redirect, url_for, request, session, jsonify
from werkzeug.utils import secure_filename
import tempfile
import uuid
from converter import convert_csv_to_dat
import logging
import time
import datetime
from flask import send_file

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-key-for-testing')
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20MB max upload size

# Create upload folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Add Jinja filter for current year
@app.template_filter('now')
def now_filter(format_string):
    return datetime.datetime.now().strftime(format_string)

# Helper functions
def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def save_uploaded_file(file, allowed_extensions):
    if file and allowed_file(file.filename, allowed_extensions):
        filename = secure_filename(file.filename)
        # Create a unique filename to avoid collisions
        unique_filename = f"{uuid.uuid4()}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)
        return filepath
    return None

@app.route('/')
def index():
    # Clean up old files from previous sessions
    try:
        for file in os.listdir(app.config['UPLOAD_FOLDER']):
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], file)
            if os.path.isfile(file_path) and (os.path.getmtime(file_path) < (time.time() - 3600)):
                os.remove(file_path)
    except Exception as e:
        logging.error(f"Error cleaning up files: {str(e)}")
    
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert():
    if 'csv_file' not in request.files or 'earth_fix' not in request.files or 'earth_nav' not in request.files:
        flash('All files are required', 'error')
        return redirect(url_for('index'))

    csv_file = request.files['csv_file']
    earth_fix = request.files['earth_fix']
    earth_nav = request.files['earth_nav']

    # Validate and save files
    csv_path = save_uploaded_file(csv_file, {'csv'})
    earth_fix_path = save_uploaded_file(earth_fix, {'dat'})
    earth_nav_path = save_uploaded_file(earth_nav, {'dat'})

    if not all([csv_path, earth_fix_path, earth_nav_path]):
        flash('Invalid files. Please check file types (CSV for data, DAT for X-Plane files).', 'error')
        return redirect(url_for('index'))

    # Generate output file path
    output_filename = f"airway_{uuid.uuid4()}.dat"
    output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)

    try:
        # Run the conversion process
        result = convert_csv_to_dat(csv_path, earth_fix_path, earth_nav_path, output_path)
        
        # Store output path in session for download
        session['output_file'] = output_path
        session['output_filename'] = 'airway.dat'  # Default download name
        session['conversion_stats'] = result
        
        flash('Conversion completed successfully!', 'success')
        return redirect(url_for('download'))
    except Exception as e:
        logging.error(f"Conversion error: {str(e)}")
        flash(f'Error during conversion: {str(e)}', 'error')
        return redirect(url_for('index'))

@app.route('/download')
def download():
    if 'output_file' not in session:
        flash('No converted file available for download', 'error')
        return redirect(url_for('index'))
        
    return render_template('download.html', stats=session.get('conversion_stats', {}))

@app.route('/get_file')
def get_file():
    if 'output_file' not in session:
        flash('No converted file available for download', 'error')
        return redirect(url_for('index'))
    
    output_path = session['output_file']
    download_name = session['output_filename']
    
    if not os.path.exists(output_path):
        flash('Generated file not found', 'error')
        return redirect(url_for('index'))
    
    return send_file(output_path, as_attachment=True, download_name=download_name)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) 