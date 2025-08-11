import os
import json
import numpy as np
import cv2
from skimage import color
import subprocess

UPLOAD_FOLDER = 'uploads'
CALIBRATION_FILE = 'calibration.json'

# ✅ Clockwise rotation angles for each face
ROTATIONS = {
    'U': 0,
    'R': 90,
    'F': 90,
    'D': 90,
    'L': 180,
    'B': 180
}

def rotate_image(img, angle):
    """Rotate image clockwise by given angle"""
    if angle == 0:
        return img
    elif angle == 90:
        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    elif angle == 180:
        return cv2.rotate(img, cv2.ROTATE_180)
    elif angle == 270:
        return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    else:
        raise ValueError(f"Unsupported rotation angle: {angle}")

def closest_color(bgr, reference_colors):
    lab = color.rgb2lab(np.uint8([[bgr]]))[0][0]
    print(f"\nSticker LAB: {lab}")

    closest = None
    min_dist = float('inf')
    for face, ref in reference_colors.items():
        ref_lab = np.array(ref['lab'])
        dist = np.linalg.norm(lab - ref_lab)
        print(f"  ? {ref['label']} distance: {dist:.2f}")
        if dist < min_dist:
            min_dist = dist
            closest = ref['label']

    print(f"? Closest label: {closest}\n")
    return closest

def extract_face_colors(image_path, face, reference_colors):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Image not found: {image_path}")

    # ✅ Rotate correctly before sampling
    angle = ROTATIONS[face]
    img = rotate_image(img, angle)
    print(f"✅ Rotated {face} face by {angle}° clockwise")

    stickers = []
    h, w, _ = img.shape
    step_x, step_y = w // 3, h // 3

    for row in range(3):
        for col in range(3):
            x, y = int((col + 0.5) * step_x), int((row + 0.5) * step_y)
            bgr = img[y, x].tolist()
            label = closest_color(bgr, reference_colors)
            stickers.append(label)

    return ''.join(stickers)

def main():
    print("? Waiting for all 6 face images...")

    faces = ['U', 'R', 'F', 'D', 'L', 'B']  # URFDLB order
    file_names = [f'face_{f}.jpg' for f in faces]

    for f in file_names:
        if not os.path.exists(os.path.join(UPLOAD_FOLDER, f)):
            print(f"Missing {f}")
            return

    with open(CALIBRATION_FILE) as f:
        reference_colors = json.load(f)

    cube_state = ''
    for face in faces:
        file_path = os.path.join(UPLOAD_FOLDER, f'face_{face}.jpg')
        print(f"?? Analyzing {file_path} ...")
        face_string = extract_face_colors(file_path, face, reference_colors)
        print(f"? Face {face} result: {face_string}")
        cube_state += face_string

    print("\n? Final 54-character cube state:")
    print(cube_state)

    with open('cube_state.txt', 'w') as f:
        f.write(cube_state)
    print("? Cube state saved to cube_state.txt")

    print("\n? Running solve_cube.py ...")
    subprocess.run(["python3", "solve_cube.py"])

if __name__ == "__main__":
    main()
