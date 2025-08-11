"""
Diagnostic helper functions for cube image processing and solving
"""
import subprocess
import os
import sys
import importlib.util
from datetime import datetime

def clear_previous_moves():
    """Clear any previous solving moves to prevent reusing old solutions"""
    try:
        moves_file = 'moves.txt'
        if os.path.exists(moves_file):
            with open(moves_file, 'w') as f:
                f.write('')  # Clear the file
            print(f"Cleared previous moves from {moves_file}")
        return True
    except Exception as e:
        print(f"Error clearing previous moves: {e}")
        return False

def process_cube_images_with_diagnostics():
    """Process cube images with detailed diagnostic information"""
    diagnostics = {
        'timestamp': datetime.utcnow().isoformat(),
        'process': 'image_processing',
        'files_checked': [],
        'missing_dependencies': [],
        'errors': []
    }
    
    try:
        # Check if required image files exist
        required_faces = ['U', 'R', 'F', 'D', 'L', 'B']
        upload_folder = 'uploads'
        
        for face in required_faces:
            filename = f'face_{face}.jpg'
            filepath = os.path.join(upload_folder, filename)
            file_info = {
                'face': face,
                'filename': filename,
                'exists': os.path.exists(filepath),
                'size': os.path.getsize(filepath) if os.path.exists(filepath) else 0
            }
            diagnostics['files_checked'].append(file_info)
            
            if not file_info['exists']:
                diagnostics['errors'].append(f"Missing image file for face {face}")
            elif file_info['size'] == 0:
                diagnostics['errors'].append(f"Empty image file for face {face}")
        
        # Check for required Python libraries
        required_libs = ['cv2', 'numpy', 'PIL', 'sklearn']
        for lib in required_libs:
            try:
                spec = importlib.util.find_spec(lib)
                if spec is None:
                    diagnostics['missing_dependencies'].append(lib)
            except ImportError:
                diagnostics['missing_dependencies'].append(lib)
        
        # Run the actual processing
        result = subprocess.run(['python3', 'process_cube.py'], 
                              capture_output=True, text=True, timeout=30)
        
        diagnostics['return_code'] = result.returncode
        diagnostics['stdout'] = result.stdout
        diagnostics['stderr'] = result.stderr
        
        if result.returncode == 0:
            # Check if output file was created
            if os.path.exists('cube_state.txt'):
                with open('cube_state.txt', 'r') as f:
                    cube_state = f.read().strip()
                    diagnostics['cube_state'] = cube_state
                    diagnostics['cube_state_length'] = len(cube_state)
                    
                    # Validate cube state format
                    if len(cube_state) != 54:
                        diagnostics['errors'].append(f"Invalid cube state length: {len(cube_state)} (expected 54)")
                        return {'success': False, 'diagnostics': diagnostics}
            else:
                diagnostics['errors'].append("No cube_state.txt file generated")
                return {'success': False, 'diagnostics': diagnostics}
            
            return {'success': True, 'diagnostics': diagnostics}
        else:
            diagnostics['errors'].append(f"Process failed with return code {result.returncode}")
            if result.stderr:
                diagnostics['errors'].append(f"Error output: {result.stderr}")
            return {'success': False, 'diagnostics': diagnostics}
            
    except subprocess.TimeoutExpired:
        diagnostics['errors'].append("Processing timed out after 30 seconds")
        return {'success': False, 'diagnostics': diagnostics}
    except Exception as e:
        diagnostics['errors'].append(f"Unexpected error: {str(e)}")
        return {'success': False, 'diagnostics': diagnostics}

def solve_cube_with_diagnostics():
    """Solve cube with detailed diagnostic information"""
    diagnostics = {
        'timestamp': datetime.utcnow().isoformat(),
        'process': 'cube_solving',
        'errors': [],
        'missing_dependencies': []
    }
    
    try:
        # Check if cube_state.txt exists
        if not os.path.exists('cube_state.txt'):
            diagnostics['errors'].append("No cube_state.txt file found - run image processing first")
            return {'success': False, 'diagnostics': diagnostics}
        
        # Check for required solving libraries
        required_libs = ['kociemba']
        for lib in required_libs:
            try:
                spec = importlib.util.find_spec(lib)
                if spec is None:
                    diagnostics['missing_dependencies'].append(lib)
            except ImportError:
                diagnostics['missing_dependencies'].append(lib)
        
        # Read cube state
        with open('cube_state.txt', 'r') as f:
            cube_state = f.read().strip()
            diagnostics['input_cube_state'] = cube_state
            diagnostics['input_length'] = len(cube_state)
        
        # Run the actual solving
        result = subprocess.run(['python3', 'solve_cube.py'], 
                              capture_output=True, text=True, timeout=60)
        
        diagnostics['return_code'] = result.returncode
        diagnostics['stdout'] = result.stdout
        diagnostics['stderr'] = result.stderr
        
        if result.returncode == 0:
            # Check if moves file was created
            if os.path.exists('moves.txt'):
                with open('moves.txt', 'r') as f:
                    moves = f.read().strip()
                    diagnostics['solution_moves'] = moves
                    diagnostics['moves_count'] = len(moves.split()) if moves else 0
                    
                    if not moves:
                        diagnostics['errors'].append("Empty solution generated")
                        return {'success': False, 'diagnostics': diagnostics}
            else:
                diagnostics['errors'].append("No moves.txt file generated")
                return {'success': False, 'diagnostics': diagnostics}
            
            return {'success': True, 'diagnostics': diagnostics}
        else:
            diagnostics['errors'].append(f"Solving failed with return code {result.returncode}")
            if result.stderr:
                diagnostics['errors'].append(f"Error output: {result.stderr}")
            return {'success': False, 'diagnostics': diagnostics}
            
    except subprocess.TimeoutExpired:
        diagnostics['errors'].append("Solving timed out after 60 seconds")
        return {'success': False, 'diagnostics': diagnostics}
    except Exception as e:
        diagnostics['errors'].append(f"Unexpected error: {str(e)}")
        return {'success': False, 'diagnostics': diagnostics}
