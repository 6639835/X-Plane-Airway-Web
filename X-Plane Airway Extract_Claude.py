import csv
import re
import os
import logging
from tqdm import tqdm
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
from enum import Enum

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

class NavigationType(Enum):
    DESIGNATED_POINT = ('DESIGNATED_POINT', '11')
    VORDME = ('VORDME', '3')
    NDB = ('NDB', '2')

    def __init__(self, code_type: str, type_code: str):
        self.code_type = code_type
        self.type_code = type_code

@dataclass
class NavigationPoint:
    identifier: str
    type: NavigationType
    area_code: Optional[str] = None

def get_navigation_type(code_type: str) -> Optional[NavigationType]:
    """Get the navigation type from the code type string.
    
    Args:
        code_type: String representing the navigation type code
        
    Returns:
        NavigationType enum if found, None otherwise
    """
    if not code_type:
        logging.error("Empty code type provided")
        return None
        
    for nav_type in NavigationType:
        if nav_type.code_type == code_type:
            return nav_type
    logging.warning(f"Unknown navigation type encountered: {code_type}")
    return None

def process_navigation_point(
    identifier: str,
    code_type: str,
    earth_fix_data: Dict[str, str],
    earth_nav_data: Dict[str, str]
) -> Optional[NavigationPoint]:
    """Process a navigation point and return its details.
    
    Args:
        identifier: The navigation point identifier
        code_type: The type of navigation point
        earth_fix_data: Dictionary of fix point data
        earth_nav_data: Dictionary of navigation point data
        
    Returns:
        NavigationPoint object if valid, None otherwise
    """
    if not identifier:
        logging.error("Empty identifier provided")
        return None
        
    nav_type = get_navigation_type(code_type)
    if not nav_type:
        return None

    # Get area code based on navigation type
    area_code = None
    if nav_type == NavigationType.DESIGNATED_POINT:
        area_code = earth_fix_data.get(identifier)
        if not area_code:
            logging.warning(f"No area code found for fix point {identifier}")
    else:  # VORDME or NDB
        area_code = earth_nav_data.get(identifier)
        if not area_code:
            logging.warning(f"No area code found for {nav_type.code_type} point {identifier}")

    if not area_code:
        return None

    return NavigationPoint(
        identifier=identifier,
        type=nav_type,
        area_code=area_code
    )

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
        if not os.path.exists(filepath):
            logging.error(f"File not found: {filepath}")
            return {}
            
        with open(filepath, 'r', encoding='utf-8') as file:
            for line_num, line in enumerate(file, 1):
                line = line.strip()
                if not line:  # Skip empty lines
                    continue
                    
                parts = line.split()
                if len(parts) <= max(key_index, value_index):
                    logging.warning(f"Line {line_num} has insufficient columns: {line}")
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
                    key = parts[key_index]
                    value = parts[value_index]
                    data[key] = value
                    
        logging.info(f"Successfully loaded {len(data)} entries from {filepath}")
        return data
        
    except Exception as e:
        logging.error(f"Error loading data from {filepath}: {str(e)}")
        return {}


def sort_key(line: str) -> tuple:
    """
    Extract sort key from a line based on the last component.
    
    Args:
        line: Text line to analyze
        
    Returns:
        Tuple for sorting (letters, numbers)
        
    Raises:
        ValueError: If the line is empty or invalid
    """
    if not line or not isinstance(line, str):
        raise ValueError("Invalid input: line must be a non-empty string")
        
    parts = line.split()
    if not parts:
        raise ValueError("Empty line provided")
        
    last_part = parts[-1]
    match = re.match(r"([A-Z]+)(\d*)$", last_part)
    if match:
        letters, numbers = match.groups()
        numbers = int(numbers) if numbers else 0
        return (letters, numbers)
    return (last_part, float('inf'))


def convert_csv_to_dat(csv_file: str, earth_fix_path: str, earth_nav_path: str, output_file: str) -> None:
    """
    Convert navigation data from CSV format to X-Plane DAT format.
    
    Args:
        csv_file: Path to input CSV file
        earth_fix_path: Path to earth_fix.dat reference file
        earth_nav_path: Path to earth_nav.dat reference file
        output_file: Path for output DAT file
        
    Raises:
        FileNotFoundError: If any input file is not found
        ValueError: If input files are invalid
    """
    # Validate input files
    for file_path in [csv_file, earth_fix_path, earth_nav_path]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
    
    # Load reference data
    logging.info("Loading reference data...")
    earth_fix_data = load_fixed_width_data(
        earth_fix_path, 2, 4, 3, {"ENRT"}, 3, "ENRT"
    )
    earth_nav_data = load_fixed_width_data(
        earth_nav_path, 7, 9, 8, {"ENRT"}, 8, "ENRT"
    )
    
    if not earth_fix_data or not earth_nav_data:
        raise ValueError("Failed to load reference data")
        
    logging.info(f"Loaded {len(earth_fix_data)} fix points and {len(earth_nav_data)} nav points")
    
    output_lines = []
    skipped_rows = 0
    processed_rows = 0

    try:
        with open(csv_file, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            required_fields = {'CODE_POINT_START', 'CODE_TYPE_START', 'CODE_POINT_END', 
                             'CODE_TYPE_END', 'CODE_DIR', 'TXT_DESIG'}
            
            # Validate CSV header
            if not all(field in reader.fieldnames for field in required_fields):
                raise ValueError(f"CSV file missing required fields: {required_fields}")
            
            for row in tqdm(reader, desc="Processing Rows"):
                processed_rows += 1
                
                # Validate required fields
                if not all(row.get(field) for field in required_fields):
                    logging.warning(f"Row {processed_rows} missing required fields")
                    skipped_rows += 1
                    continue
                
                # Process start point
                start_point = process_navigation_point(
                    identifier=row['CODE_POINT_START'],
                    code_type=row['CODE_TYPE_START'],
                    earth_fix_data=earth_fix_data,
                    earth_nav_data=earth_nav_data
                )
                
                if not start_point:
                    skipped_rows += 1
                    continue

                # Use the processed data
                first_part = start_point.identifier
                second_part = start_point.area_code
                third_part = start_point.type.type_code

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
        try:
            output_lines.sort(key=sort_key)
            
            # Ensure output directory exists
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as datfile:
                datfile.writelines(output_lines)

            logging.info(f"Processing completed! Wrote {len(output_lines)} lines to {output_file}")
            if skipped_rows > 0:
                logging.warning(f"Skipped {skipped_rows} rows due to missing or invalid data")
                
        except Exception as e:
            logging.error(f"Error writing output file: {str(e)}")
            raise
            
    except Exception as e:
        logging.error(f"Error during processing: {str(e)}")
        raise


if __name__ == "__main__":
    # Example usage - replace with your paths or use command line arguments
    csv_file = '/Users/lujuncheng/Downloads/RTE_SEG.csv'
    earth_fix_path = '/Users/lujuncheng/Library/Application Support/Steam/steamapps/common/X-Plane 12/Custom Data/earth_fix.dat'
    earth_nav_path = '/Users/lujuncheng/Library/Application Support/Steam/steamapps/common/X-Plane 12/Custom Data/earth_nav.dat'
    output_file = '/Users/lujuncheng/Downloads/PMDG NavData/airway2503.dat'
    
    convert_csv_to_dat(csv_file, earth_fix_path, earth_nav_path, output_file)