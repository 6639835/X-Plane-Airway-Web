from flask import Flask, render_template, request, send_file, flash, redirect, url_for
import csv
import re
import os
import logging
import tempfile
from werkzeug.utils import secure_filename
from typing import Dict, List, Optional, Set

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Create uploads directory if it doesn't exist
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
TEMP_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TEMP_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # Increase to 100MB max upload size

ALLOWED_EXTENSIONS = {'csv', 'dat'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_fixed_width_data(filepath: str, key_index: int, value_index: int, 
                          extra_condition_index: Optional[int] = None, 
                          extra_condition_values: Optional[Set[str]] = None,
                          type_index: Optional[int] = None, 
                          type_value: Optional[str] = None) -> Dict[str, str]:
    """
    Load data from a fixed-width file into a dictionary.
    
    Args:
        filepath: Path to the data file
        key_index: Column index to use as dictionary key
        value_index: Column index to use as dictionary value
        extra_condition_index: Optional index for filtering data
        extra_condition_values: Set of accepted values for the extra condition
        type_index: Optional index for type filtering
        type_value: Value to match for type filtering
        
    Returns:
        Dictionary mapping keys to values from the specified file
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


def sort_key(line: str) -> tuple:
    """
    Extract sort key from a line based on the last component.
    
    Args:
        line: Text line to analyze
        
    Returns:
        Tuple for sorting (letters, numbers)
    """
    last_part = line.split()[-1]
    match = re.match(r"([A-Z]+)(\d*)$", last_part)
    if match:
        letters, numbers = match.groups()
        numbers = int(numbers) if numbers else 0
        return (letters, numbers)
    return (last_part, float('inf'))


def convert_csv_to_dat(csv_file: str, earth_fix_path: str, earth_nav_path: str, output_file: str) -> dict:
    """
    Convert navigation data from CSV format to X-Plane DAT format.
    
    Args:
        csv_file: Path to input CSV file
        earth_fix_path: Path to earth_fix.dat reference file
        earth_nav_path: Path to earth_nav.dat reference file
        output_file: Path for output DAT file
        
    Returns:
        Dictionary with stats about the conversion
    """
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
                        f"{tenth_part:>4} {eleventh_part}\n"
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


@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')


@app.route('/convert', methods=['POST'])
def convert():
    if 'csv_file' not in request.files or 'earth_fix' not in request.files or 'earth_nav' not in request.files:
        flash('All three files are required')
        return redirect(request.url)
    
    csv_file = request.files['csv_file']
    earth_fix = request.files['earth_fix']
    earth_nav = request.files['earth_nav']
    
    # Check if files were selected
    if csv_file.filename == '' or earth_fix.filename == '' or earth_nav.filename == '':
        flash('All three files are required')
        return redirect(request.url)
    
    # Check if files have allowed extensions
    if not all(allowed_file(f.filename) for f in [csv_file, earth_fix, earth_nav]):
        flash('Invalid file type. Please upload CSV for route data and DAT for reference files.')
        return redirect(request.url)
    
    # Save uploaded files
    csv_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(csv_file.filename))
    earth_fix_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(earth_fix.filename))
    earth_nav_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(earth_nav.filename))
    
    csv_file.save(csv_path)
    earth_fix.save(earth_fix_path)
    earth_nav.save(earth_nav_path)
    
    # Generate output filename
    output_filename = f"airway_{os.path.splitext(secure_filename(csv_file.filename))[0]}.dat"
    output_path = os.path.join(TEMP_FOLDER, output_filename)
    
    # Process the files
    result = convert_csv_to_dat(csv_path, earth_fix_path, earth_nav_path, output_path)
    
    if result["success"]:
        return render_template('success.html', 
                              lines_written=result["lines_written"],
                              skipped_rows=result["skipped_rows"],
                              output_file=output_filename)
    else:
        flash(result["message"])
        return redirect(url_for('index'))


@app.route('/success')
def success():
    lines_written = request.args.get('lines', '0')
    skipped_rows = request.args.get('skipped', '0')
    download_url = request.args.get('url', '')
    filename = request.args.get('filename', '')
    
    return render_template('success.html',
                          lines_written=lines_written,
                          skipped_rows=skipped_rows,
                          download_url=download_url,
                          filename=filename)


@app.route('/download/<filename>')
def download(filename):
    return send_file(os.path.join(TEMP_FOLDER, filename),
                     as_attachment=True)


# Use this for local development
if __name__ == "__main__":
    app.run(debug=True)

# This is needed for Vercel deployment
app = app 