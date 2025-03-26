# X-Plane Airway Generator

A web application for converting navigation route data from CSV format to X-Plane's DAT format. This tool is a web-based conversion of the X-Plane Airway Extract script.

## Features

- Upload and process CSV files containing route data
- Reference earth_fix.dat and earth_nav.dat files for point validation
- Generate properly formatted airway DAT files for X-Plane
- Beautiful, responsive web interface
- Detailed conversion statistics

## Requirements

- Python 3.6+
- Flask
- tqdm
- Werkzeug

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/x-plane-airway-web.git
   cd x-plane-airway-web
   ```

2. Create a virtual environment (optional but recommended):
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage

1. Start the application:
   ```
   python app.py
   ```

2. Open your web browser and navigate to:
   ```
   http://127.0.0.1:5000/
   ```

3. Upload your files:
   - CSV file containing route data (must include CODE_POINT_START, CODE_TYPE_START, CODE_POINT_END, CODE_TYPE_END, CODE_DIR, TXT_DESIG columns)
   - earth_fix.dat reference file from X-Plane's Custom Data folder
   - earth_nav.dat reference file from X-Plane's Custom Data folder

4. Click the "Convert" button to process the data

5. Download the generated airway DAT file

6. Place the DAT file in your X-Plane's Custom Data folder

## Input CSV Format

The input CSV file should contain the following columns:
- `CODE_POINT_START`: Starting point identifier
- `CODE_TYPE_START`: Type of the starting point (DESIGNATED_POINT, VORDME, or VOR)
- `CODE_POINT_END`: Ending point identifier
- `CODE_TYPE_END`: Type of the ending point (DESIGNATED_POINT, VORDME, or VOR)
- `CODE_DIR`: Direction code (N or any other value)
- `TXT_DESIG`: Airway designation/name

## License

[MIT License](LICENSE)

## Acknowledgements

This project is a web-based adaptation of the X-Plane Airway Extract script for easier usage. 