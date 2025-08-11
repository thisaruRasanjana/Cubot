# solve_cube.py

import kociemba
from collections import Counter
import requests  # Optional for ESP32

def main():
    # 1. Read the cube state
    with open('cube_state.txt') as f:
        raw_state = f.read().strip()
    print(f"🔢 Raw 54-character cube string:\n{raw_state}\n")

    # 2. Map your colors to URFDLB
    # W = White → U
    # R = Red → R
    # G = Green → F
    # Y = Yellow → D
    # P = Purple → L (was Orange)
    # B = Blue → B
    color_map = {'W': 'U', 'R': 'R', 'G': 'F', 'Y': 'D', 'P': 'L', 'B': 'B'}
    mapped_state = ''.join(color_map[c] for c in raw_state)

    print(f"🔤 Mapped cube string:\n{mapped_state}\n")

    # 3. Validate basic counts
    counts = Counter(mapped_state)
    print(f"✅ Color counts: {counts}")

    if len(mapped_state) != 54:
        print("❌ Invalid cube string length!")
        return

    if any(count != 9 for count in counts.values()):
        print("❌ One or more colors don't have 9 stickers each!")
        return

    # 4. Validate center facelets: they MUST be URFDLB
    centers = mapped_state[4] + mapped_state[13] + mapped_state[22] + mapped_state[31] + mapped_state[40] + mapped_state[49]
    print(f"🎯 Centers in order: {centers}")
    if set(centers) != set("URFDLB"):
        print("❌ Invalid centers! They must be URFDLB exactly once each.")
        return

    # 5. Solve with Kociemba
    try:
        moves = kociemba.solve(mapped_state)
        print(f"✅ Solution moves:\n{moves}")
    except Exception as e:
        print(f"❌ Error solving cube: {e}")
        return

    # 6. Save to file
    with open('moves.txt', 'w') as f:
        f.write(moves)
    print("✅ Moves saved to moves.txt")

    # 7. Optional: Send to ESP32 if needed
    try:
        response = requests.post(
            'http://YOUR_ESP32_IP/solve',
            json={"moves": moves}
        )
        print(f"🌐 Sent to ESP32, response: {response.status_code}")
    except Exception as e:
        print(f"⚠ Could not send to ESP32: {e}")

if __name__ == "__main__":
    main()
