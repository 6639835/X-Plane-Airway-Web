# X-Plane Airway Converter

A web application for converting airway data from CSV format to X-Plane DAT format.

## Features

- Convert airway segment data from CSV to X-Plane DAT format
- Process navigation points with proper area codes
- Support for different navigation point types (DESIGNATED_POINT, VORDME, NDB)
- Modern, responsive web interface
- Live validation and feedback
- Detailed conversion statistics

## Requirements

- Python 3.8+
- Flask and dependencies (see requirements.txt)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/x-plane-airway-converter.git
cd x-plane-airway-converter
```

2. Create a virtual environment and activate it:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install the required packages:
```bash
pip install -r requirements.txt
```

## Usage

1. Start the application:
```bash
python app.py
```

2. Open your web browser and navigate to:
```
http://127.0.0.1:5000/
```

3. Upload the required files:
   - CSV file with airway data (must contain required fields: CODE_POINT_START, CODE_TYPE_START, CODE_POINT_END, CODE_TYPE_END, CODE_DIR, TXT_DESIG)
   - earth_fix.dat from X-Plane Custom Data folder
   - earth_nav.dat from X-Plane Custom Data folder

4. Click "Convert Data" and wait for the process to complete

5. Download the generated airway.dat file and place it in your X-Plane Custom Data folder

## CSV File Format

The input CSV file must include the following columns:
- `CODE_POINT_START`: Start navigation point identifier
- `CODE_TYPE_START`: Type of start navigation point (DESIGNATED_POINT, VORDME, NDB)
- `CODE_POINT_END`: End navigation point identifier
- `CODE_TYPE_END`: Type of end navigation point (DESIGNATED_POINT, VORDME, NDB)
- `CODE_DIR`: Direction code (N for two-way, other values for one-way)
- `TXT_DESIG`: Airway designator

## License

This project is open source and available under the MIT License.

## Acknowledgements

- X-Plane for the flight simulator platform
- Flask for the web framework
- Bootstrap for the UI components 