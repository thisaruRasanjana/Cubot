#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

Adafruit_PWMServoDriver pca = Adafruit_PWMServoDriver();

/* ───────────────────────────  CONSTANTS  ─────────────────────────── */
#define SERVOMIN       102
#define SERVOMAX       575

#define FRONT_ARM 0
#define LEFT_ARM  3
#define BACK_ARM  2
#define RIGHT_ARM 1

// Gripper forward positions - RIGHT GRIPPER UPDATED FROM 153 TO 155
#define FRONT_GRIP_FWD 165
#define BACK_GRIP_FWD  165
#define LEFT_GRIP_FWD  155
#define RIGHT_GRIP_FWD 155  // CHANGED FROM 153 TO 155

// Rotator vertical positions
#define FRONT_ROT_VERT 88
#define BACK_ROT_VERT  88
#define LEFT_ROT_VERT  92
#define RIGHT_ROT_VERT 94

// Common positions
#define HORIZONTAL_POS 0
#define GRIPPER_BACK   10

// Inter-move delay optimization
#define COMPLEX_MOVE_DELAY 150  // For U/D moves (more complex)
#define SIMPLE_MOVE_DELAY  75   // For R/L/F/B moves (simpler)

/* ───────────────────────────  GLOBAL VARIABLES  ──────────────────── */
String receivedMoves = "";
bool cubeIsGripped = false;

/* ───────────────────────────  ARRAYS  ────────────────────────────── */
int grippers[4] = {6, 2, 10, 14};  // [FRONT, RIGHT, BACK, LEFT] pins
int rotators [4] = {4, 0, 8, 12};  // [FRONT, RIGHT, BACK, LEFT] pins

/* ───────────────────────────  HELPERS  ───────────────────────────── */
int angleToPWM(int angle) {
  return map(angle, 0, 180, SERVOMIN, SERVOMAX);
}

int getGripperForwardAngle(int arm) {
  switch(arm) {
    case FRONT_ARM: return FRONT_GRIP_FWD;
    case LEFT_ARM:  return LEFT_GRIP_FWD;
    case BACK_ARM:  return BACK_GRIP_FWD;
    case RIGHT_ARM: return RIGHT_GRIP_FWD;  // NOW RETURNS 155 INSTEAD OF 153
    default: return 158;
  }
}

int getRotatorVerticalAngle(int arm) {
  switch(arm) {
    case FRONT_ARM: return FRONT_ROT_VERT;
    case LEFT_ARM:  return LEFT_ROT_VERT;
    case BACK_ARM:  return BACK_ROT_VERT;
    case RIGHT_ARM: return RIGHT_ROT_VERT;
    default: return 90;
  }
}

// Enhanced function to validate move sequences including double prime moves
bool isValidMoveSequence(String moves) {
  moves.trim();
  moves.toUpperCase();
  
  // Check for known non-move commands first
  if (moves.equals("PING") || moves.equals("PONG") || 
      moves.equals("STATUS") || moves.equals("HELLO") ||
      moves.equals("TEST") || moves.equals("RELEASE") ||
      moves.equals("SCAN") || moves.equals("INIT") ||
      moves.equals("GRIP")) {
    return false;
  }
  
  if (moves.length() == 0) return false;
  
  for (int i = 0; i < moves.length(); i++) {
    char c = moves[i];
    
    if (c == ' ') continue;
    
    // Valid face characters
    if (c == 'R' || c == 'L' || c == 'U' || c == 'D' || c == 'F' || c == 'B') {
      // Check what follows the face letter
      int nextPos = i + 1;
      
      // Handle prime notation
      if (nextPos < moves.length() && moves[nextPos] == '\'') {
        nextPos++; // Skip apostrophe
        
        // Check for double prime (e.g., R'2)
        if (nextPos < moves.length() && moves[nextPos] == '2') {
          i = nextPos; // Skip both ' and 2
        } else {
          i = nextPos - 1; // Just skip the apostrophe
        }
      }
      // Handle double moves (e.g., R2)
      else if (nextPos < moves.length() && moves[nextPos] == '2') {
        i = nextPos; // Skip the 2
      }
    }
    else {
      return false; // Invalid character
    }
  }
  
  return true;
}

/* ───────────────────────────  RELEASE & INITIAL GRIP  ───────────── */
void releaseAllArms() {
  Serial.println("Releasing all arms…");
  for(int i=0;i<4;i++){
    pca.setPWM(grippers[i],0,angleToPWM(GRIPPER_BACK)); delay(150); // 200→150
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i],0,angleToPWM(vertAngle)); delay(150); // 200→150
  }
  Serial.println("Done.");
}

void initialGripCube() {
  Serial.println("Initial grip with all 4 arms…");
  
  // Set all rotators to vertical position
  for(int i = 0; i < 4; i++){
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i], 0, angleToPWM(vertAngle)); 
    delay(225); // 300→225
  }
  
  // Set all grippers to forward position - NOW RIGHT GRIPPER GOES TO 155°
  for(int i = 0; i < 4; i++){
    int tgt = getGripperForwardAngle(i);
    pca.setPWM(grippers[i], 0, angleToPWM(tgt)); 
    delay(375); // 500→375
  }
  
  Serial.println("All 4 arms gripping cube - ready for moves.");
}

/* ───────────────────────────  UPDATED 6-POSITION SCAN FUNCTION  ──────────────────────── */
void prepareForScan() {
  Serial.println("Prep for 6-position scan with final restoration");
  
  // Set all rotators to vertical - F:88°, R:94°, B:88°, L:92°
  for(int i = 0; i < 4; i++){
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i], 0, angleToPWM(vertAngle));
    delay(150); // 200→150
  }

  // Set all grippers forward - F:165°, R:155°, B:165°, L:155° (RIGHT UPDATED)
  for(int i = 0; i < 4; i++){
    int tgt = getGripperForwardAngle(i);
    pca.setPWM(grippers[i], 0, angleToPWM(tgt));
    delay(225); // 300→225
  }
  
  Serial.println("6-position scan preparation complete.");
}

// Helper function for Position 1 NEW (with extra grip tightening)
void scanPosition1New() {
  Serial.println("Position 1 NEW (front/back faces with extra grip)");
  
  // Release Front & Back grippers → 10°
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225);
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225);
  
  // Right & Left tighter → R:157° (155+2), L:157° (155+2) - RIGHT UPDATED
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(157));
  delay(225);
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(157));
  delay(225);
  
  // Rotate Front rotator to 175°, Back rotator to 0°
  pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(175));
  delay(225);
  pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(0));
  delay(375);
  
  // Re-grip Front & Back tighter → F:173° (165+8), B:173° (165+8) - UPDATED
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(173));
  delay(225);
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(173));
  delay(225);
  
  // Release Left & Right grippers → 10°
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225);
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225);
}

// Helper function for Position 1 OLD (original version)
void scanPosition1Old() {
  Serial.println("Position 1 OLD (front/back faces standard)");
  
  // Release Front & Back grippers → 10°
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225);
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225);
  
  // Rotate Front rotator to 175°, Back rotator to 0°
  pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(175));
  delay(225);
  pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(0));
  delay(375);
  
  // Re-grip Front & Back tighter → F:173° (165+8), B:173° (165+8) - UPDATED
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(173));
  delay(225);
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(173));
  delay(225);
  
  // Release Left & Right grippers → 10°
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225);
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225);
}

// Helper function for Position 2 (left/right faces)
void scanPosition2() {
  Serial.println("Position 2 (left/right faces)");
  
  // Return Front & Back rotators to vertical (88°, 88°)
  pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(getRotatorVerticalAngle(FRONT_ARM)));
  pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(getRotatorVerticalAngle(BACK_ARM)));
  delay(375);
  
  // Rotate Right rotator to 5°, Left rotator to 175°
  pca.setPWM(rotators[RIGHT_ARM], 0, angleToPWM(5));
  delay(225);
  pca.setPWM(rotators[LEFT_ARM], 0, angleToPWM(175));
  delay(375);
  
  // Re-grip Right & Left tighter → R:160° (155+5), L:160° (155+5) - RIGHT UPDATED
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(160));
  delay(225);
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(160));
  delay(225);
  
  // Release Front & Back grippers → 10°
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225);
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225);
}

void performScan() {
  Serial.println("Starting 6-position scan sequence with updated F/B grip angles");
  
  prepareForScan();
  
  // ═══════════ Position 1 NEW (front/back faces with extra grip) ═══════════
  scanPosition1New();
  Serial.println("First Scan - Waiting 8 seconds...");
  delay(8000); // KEEP 8000

  // ═══════════ Position 2 (left/right faces) ═══════════
  scanPosition2();
  Serial.println("Second Scan - Waiting 8 seconds...");
  delay(8000); // KEEP 8000

  // ═══════════ Position 3 = repeat Position 1 OLD ═══════════
  pca.setPWM(rotators[LEFT_ARM], 0, angleToPWM(getRotatorVerticalAngle(LEFT_ARM)));
  pca.setPWM(rotators[RIGHT_ARM], 0, angleToPWM(getRotatorVerticalAngle(RIGHT_ARM)));
  delay(375);
  
  scanPosition1Old();
  Serial.println("Third Scan - Waiting 8 seconds...");
  delay(8000); // KEEP 8000

  // ═══════════ Position 4 = repeat Position 2 ═══════════
  scanPosition2();
  Serial.println("Fourth Scan - Waiting 8 seconds...");
  delay(8000); // KEEP 8000

  // ═══════════ Position 5 = repeat Position 1 OLD ═══════════
  pca.setPWM(rotators[LEFT_ARM], 0, angleToPWM(getRotatorVerticalAngle(LEFT_ARM)));
  pca.setPWM(rotators[RIGHT_ARM], 0, angleToPWM(getRotatorVerticalAngle(RIGHT_ARM)));
  delay(375);
  
  scanPosition1Old();
  Serial.println("Fifth Scan - Waiting 8 seconds...");
  delay(8000); // KEEP 8000

  // ═══════════ Position 6 = repeat Position 2 ═══════════
  scanPosition2();
  Serial.println("Sixth Scan - Waiting 8 seconds...");
  delay(8000); // KEEP 8000

  // ═══════════ Final Restoration ═══════════
  // Return all rotators to vertical: F:88°, R:94°, B:88°, L:92°
  pca.setPWM(rotators[LEFT_ARM], 0, angleToPWM(getRotatorVerticalAngle(LEFT_ARM)));
  pca.setPWM(rotators[RIGHT_ARM], 0, angleToPWM(getRotatorVerticalAngle(RIGHT_ARM)));
  delay(375);
  
  Serial.println("Final restoration - returning all servos to normal positions...");
  
  // Return all grippers to forward: F:165°, R:155°, B:165°, L:155° - RIGHT UPDATED
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(getGripperForwardAngle(FRONT_ARM)));
  delay(225);
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(getGripperForwardAngle(BACK_ARM)));
  delay(225);
  
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(getGripperForwardAngle(LEFT_ARM)));
  delay(225);
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(getGripperForwardAngle(RIGHT_ARM)));
  delay(225);
  
  // Set cubeIsGripped = true
  cubeIsGripped = true;
  
  Serial.println("6-position scan sequence completed with full restoration");
  Serial.println("Cube is gripped and ready for move sequences");
}

/* ───────────────────────────  U & U' MOVES - UPDATED WITH NEW ANGLES  ───────────────────────── */
void prepareForUMove() {
  Serial.println("Prep for U move (updated angles: F:173°, B:173°)");

  // All arms vertical (F:88°, R:94°, B:88°, L:92°)
  for(int i = 0; i < 4; i++){
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i], 0, angleToPWM(vertAngle));
    delay(150); // 200→150
  }

  // All grippers forward (F:165°, R:155°, B:165°, L:155°) - RIGHT UPDATED
  for(int i = 0; i < 4; i++){
    int tgt = getGripperForwardAngle(i);
    pca.setPWM(grippers[i], 0, angleToPWM(tgt));
    delay(225); // 300→225
  }

  // Tighten front/back grip (F:173°, B:173°) - UPDATED
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(173));
  delay(225); // 300→225
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(173));
  delay(225); // 300→225

  // Release left/right grippers (L:10°, R:10°)
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225); // 300→225
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225); // 300→225

  // Rotate front/back arms horizontally (F:175°, B:0°)
  pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(175));
  pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(0));
  delay(375); // 500→375

  // Re-engage left/right grippers (L:156°, R:156°) - RIGHT UPDATED TO MATCH LEFT
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(156));
  delay(225); // 300→225
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(156));
  delay(225); // 300→225

  // Release front/back grippers (F:10°, B:10°)
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225); // 300→225
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225); // 300→225

  // Return front/back rotators to vertical (F:88°, B:88°)
  pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(getRotatorVerticalAngle(FRONT_ARM)));
  pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(getRotatorVerticalAngle(BACK_ARM)));
  delay(300); // 400→300

  // Restore all grippers to normal forward (F:165°, B:165°)
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(getGripperForwardAngle(FRONT_ARM)));
  delay(225); // 300→225  
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(getGripperForwardAngle(BACK_ARM)));
  delay(225); // 300→225

  Serial.println("U move preparation complete.");
}

void restoreAfterUMove() {
  Serial.println("Restoring after U move (updated angles: F:173°, B:173°, F:1°)");

  // Re-tighten front/back grip (F:173°, B:173°) - UPDATED
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(173));
  delay(225); // 300→225
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(173));
  delay(225); // 300→225

  // Release left/right grippers (L:10°, R:10°)
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(10));
  delay(225); // 300→225
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(10));
  delay(225); // 300→225

  // Rotate front/back arms to special positions (F:1°, B:172°) - UPDATED F from 0° to 1°
  pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(1));
  pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(172));
  delay(375); // 500→375

  // Re-engage left/right grippers (L:156°, R:156°) - RIGHT UPDATED TO MATCH LEFT
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(156));
  delay(225); // 300→225
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(156));
  delay(225); // 300→225

  // Release front/back grippers (F:10°, B:10°)
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(10));
  delay(225); // 300→225
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(10));
  delay(225); // 300→225

  // Return front/back rotators to vertical (F:88°, B:88°)
  pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(getRotatorVerticalAngle(FRONT_ARM)));
  pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(getRotatorVerticalAngle(BACK_ARM)));
  delay(300); // 400→300

  // Final restoration - all grippers to normal (F:165°, R:155°, B:165°, L:155°) - RIGHT UPDATED
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(getGripperForwardAngle(FRONT_ARM)));
  delay(225); // 300→225
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(getGripperForwardAngle(BACK_ARM)));
  delay(225); // 300→225
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(getGripperForwardAngle(LEFT_ARM)));
  delay(225); // 300→225
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(getGripperForwardAngle(RIGHT_ARM)));
  delay(225); // 300→225

  Serial.println("U move restoration complete.");
}

void prepareForU2Move() {
  prepareForUMove();
}

void restoreAfterU2Move() {
  restoreAfterUMove();
}

void performUMove(bool prime, int reps) {
  Serial.print("U");
  if(prime) Serial.print("'");
  if(reps == 2) Serial.print("2");
  Serial.println(" move");

  if(reps == 2) {
    prepareForU2Move();
    
    if(!prime) {
      performRMove(false, 2);
    } else {
      performRPrimeMove(2);
    }
    
    restoreAfterU2Move();
  } else {
    for(int r = 0; r < reps; r++) {
      Serial.print("U");
      if(prime) Serial.print("'");
      Serial.print(" #"); Serial.println(r + 1);
      
      prepareForUMove();
      
      if(!prime) {
        performRMove(false, 1);
      } else {
        performRMove(true, 1);
      }
      
      restoreAfterUMove();
    }
  }
  Serial.println("U move(s) completed.");
}

/* ───────────────────────────  D & D' MOVES - UPDATED WITH NEW ANGLES  ───────────────────────── */
void prepareForDMove() {
  Serial.println("Prep for D move (updated angles: F:173°, B:173°)");

  // All arms vertical (F:88°, R:94°, B:88°, L:92°)
  for(int i = 0; i < 4; i++){
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i], 0, angleToPWM(vertAngle));
    delay(150); // 200→150
  }

  // All grippers forward (F:165°, R:155°, B:165°, L:155°) - RIGHT UPDATED
  for(int i = 0; i < 4; i++){
    int tgt = getGripperForwardAngle(i);
    pca.setPWM(grippers[i], 0, angleToPWM(tgt));
    delay(225); // 300→225
  }

  // Tighten front/back grip (F:173°, B:173°) - UPDATED
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(173));
  delay(225); // 300→225
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(173));
  delay(225); // 300→225

  // Release left/right grippers (L:10°, R:10°)
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225); // 300→225
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225); // 300→225

  // Rotate front/back arms horizontally (F:175°, B:0°)
  pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(175));
  pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(0));
  delay(375); // 500→375

  // Re-engage left/right grippers (L:156°, R:156°) - RIGHT UPDATED TO MATCH LEFT
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(156));
  delay(225); // 300→225
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(156));
  delay(225); // 300→225

  // Release front/back grippers (F:10°, B:10°)
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225); // 300→225
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(GRIPPER_BACK));
  delay(225); // 300→225

  // Return front/back rotators to vertical (F:88°, B:88°)
  pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(getRotatorVerticalAngle(FRONT_ARM)));
  pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(getRotatorVerticalAngle(BACK_ARM)));
  delay(300); // 400→300

  // Restore all grippers to normal forward (F:165°, B:165°)
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(getGripperForwardAngle(FRONT_ARM)));
  delay(225); // 300→225  
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(getGripperForwardAngle(BACK_ARM)));
  delay(225); // 300→225

  Serial.println("D move preparation complete.");
}

void restoreAfterDMove() {
  Serial.println("Restoring after D move (updated angles: F:173°, B:173°, F:1°)");

  // Re-tighten front/back grip (F:173°, B:173°) - UPDATED
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(173));
  delay(225); // 300→225
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(173));
  delay(225); // 300→225

  // Release left/right grippers (L:10°, R:10°)
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(10));
  delay(225); // 300→225
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(10));
  delay(225); // 300→225

  // Rotate front/back arms to special positions (F:1°, B:172°) - UPDATED F from 0° to 1°
  pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(1));
  pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(172));
  delay(375); // 500→375

  // Re-engage left/right grippers (L:156°, R:156°) - RIGHT UPDATED TO MATCH LEFT
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(156));
  delay(225); // 300→225
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(156));
  delay(225); // 300→225

  // Release front/back grippers (F:10°, B:10°)
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(10));
  delay(225); // 300→225
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(10));
  delay(225); // 300→225

  // Return front/back rotators to vertical (F:88°, B:88°)
  pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(getRotatorVerticalAngle(FRONT_ARM)));
  pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(getRotatorVerticalAngle(BACK_ARM)));
  delay(300); // 400→300

  // Final restoration - all grippers to normal (F:165°, R:155°, B:165°, L:155°) - RIGHT UPDATED
  pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(getGripperForwardAngle(FRONT_ARM)));
  delay(225); // 300→225
  pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(getGripperForwardAngle(BACK_ARM)));
  delay(225); // 300→225
  pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(getGripperForwardAngle(LEFT_ARM)));
  delay(225); // 300→225
  pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(getGripperForwardAngle(RIGHT_ARM)));
  delay(225); // 300→225

  Serial.println("D move restoration complete.");
}

void prepareForD2Move() {
  prepareForDMove();
}

void restoreAfterD2Move() {
  restoreAfterDMove();
}

void performDMove(bool prime, int reps) {
  Serial.print("D");
  if(prime) Serial.print("'");
  if(reps == 2) Serial.print("2");
  Serial.println(" move");

  if(reps == 2) {
    prepareForD2Move();
    
    if(!prime) {
      performLMove(false, 2);
    } else {
      performLPrimeMove(2);
    }
    
    restoreAfterD2Move();
  } else {
    for(int r = 0; r < reps; r++) {
      Serial.print("D");
      if(prime) Serial.print("'");
      Serial.print(" #"); Serial.println(r + 1);
      
      prepareForDMove();
      
      if(!prime) {
        performLMove(false, 1);
      } else {
        performLMove(true, 1);
      }
      
      restoreAfterDMove();
    }
  }
  Serial.println("D move(s) completed.");
}

/* ───────────────────────────  R & R' MOVES  ───────────────────────── */
void prepareForRMove() {
  Serial.println("Prep for R");
  for(int i=0;i<4;i++){
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i],0,angleToPWM(vertAngle)); delay(150); // 200→150
    int tgt = getGripperForwardAngle(i);
    pca.setPWM(grippers[i],0,angleToPWM(tgt)); delay(225); // 300→225
  }
}

void performRMove(bool prime, int reps) {
  if (prime) {
    performRPrimeMove(reps);
    return;
  }
  
  prepareForRMove();
  for(int r=0;r<reps;r++){
    Serial.print("R (coordinated) #"); Serial.println(r+1);
    
    pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(GRIPPER_BACK));
    delay(225); // 300→225
    
    pca.setPWM(rotators[RIGHT_ARM], 0, angleToPWM(5));
    delay(375); // 500→375
    
    pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(getGripperForwardAngle(LEFT_ARM) + 7));
    delay(225); // 300→225
    
    // RIGHT GRIPPER: Now uses 155-7=148 instead of 153-7=146
    pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(getGripperForwardAngle(RIGHT_ARM) - 7));
    delay(225); // 300→225
    
    pca.setPWM(rotators[RIGHT_ARM], 0, angleToPWM(100));
    delay(375); // 500→375
    
    pca.setPWM(rotators[RIGHT_ARM], 0, angleToPWM(getRotatorVerticalAngle(RIGHT_ARM)));
    delay(300); // 400→300
    
    pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(getGripperForwardAngle(LEFT_ARM)));
    delay(225); // 300→225
    
    // RIGHT GRIPPER: Now returns to 155 instead of 153
    pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(getGripperForwardAngle(RIGHT_ARM)));
    delay(225); // 300→225
  }
  Serial.println("R coordinated move complete.");
}

void prepareForRPrimeMove() {
  Serial.println("Prep for R'");

  for(int i = 0; i < 4; i++){
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i], 0, angleToPWM(vertAngle));
    delay(150); // 200→150
  }

  for(int i = 0; i < 4; i++){
    int tgt = getGripperForwardAngle(i);
    pca.setPWM(grippers[i], 0, angleToPWM(tgt));
    delay(225); // 300→225
  }

  Serial.println("Pre-R' move positions achieved.");
}

void performRPrimeMove(int reps) {
  prepareForRPrimeMove();

  for(int r = 0; r < reps; r++){
    Serial.print("R' #"); Serial.println(r + 1);

    pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(GRIPPER_BACK));
    delay(225); // 300→225

    pca.setPWM(rotators[RIGHT_ARM], 0, angleToPWM(175));
    delay(375); // 500→375

    pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(getGripperForwardAngle(LEFT_ARM) + 7));
    delay(225); // 300→225

    // RIGHT GRIPPER: Now uses 155-7=148 instead of 153-7=146
    pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(getGripperForwardAngle(RIGHT_ARM) - 7));
    delay(225); // 300→225

    pca.setPWM(rotators[RIGHT_ARM], 0, angleToPWM(85));
    delay(375); // 500→375

    pca.setPWM(rotators[RIGHT_ARM], 0, angleToPWM(getRotatorVerticalAngle(RIGHT_ARM)));
    delay(300); // 400→300

    pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(getGripperForwardAngle(LEFT_ARM)));
    delay(225); // 300→225

    // RIGHT GRIPPER: Now returns to 155 instead of 153
    pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(getGripperForwardAngle(RIGHT_ARM)));
    delay(225); // 300→225
  }
  Serial.println("R' move complete.");
}

/* ───────────────────────────  L & L' MOVES  ───────────────────────── */
void prepareForLMove() {
  Serial.println("Prep for L");
  
  for(int i=0;i<4;i++){
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i],0,angleToPWM(vertAngle)); 
    delay(150); // 200→150
  }
  
  for(int i=0;i<4;i++){
    int tgt = getGripperForwardAngle(i);
    pca.setPWM(grippers[i],0,angleToPWM(tgt)); 
    delay(225); // 300→225
  }
  
  Serial.println("Pre-L move positions achieved.");
}

void performLMove(bool prime, int reps) {
  if (prime) {
    performLPrimeMove(reps);
    return;
  }
  
  prepareForLMove();
  
  for (int r = 0; r < reps; r++) {
    Serial.print("L (coordinated) #"); Serial.println(r + 1);
    
    pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(GRIPPER_BACK));
    delay(225); // 300→225
    
    pca.setPWM(rotators[LEFT_ARM], 0, angleToPWM(HORIZONTAL_POS));
    delay(375); // 500→375
    
    // RIGHT GRIPPER: Now uses 155+7=162 instead of 153+7=160
    pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(getGripperForwardAngle(RIGHT_ARM) + 7));
    delay(225); // 300→225
    
    pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(getGripperForwardAngle(LEFT_ARM) - 7));
    delay(225); // 300→225
    
    pca.setPWM(rotators[LEFT_ARM], 0, angleToPWM(100));
    delay(375); // 500→375
    
    pca.setPWM(rotators[LEFT_ARM], 0, angleToPWM(getRotatorVerticalAngle(LEFT_ARM)));
    delay(300); // 400→300
    
    // RIGHT GRIPPER: Now returns to 155 instead of 153
    pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(getGripperForwardAngle(RIGHT_ARM)));
    delay(225); // 300→225
    
    pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(getGripperForwardAngle(LEFT_ARM)));
    delay(225); // 300→225
  }
  Serial.println("L coordinated move complete.");
}

void prepareForLPrimeMove() {
  Serial.println("Prep for L' (with left-right coordination)");

  for(int i=0;i<4;i++){
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i],0,angleToPWM(vertAngle)); 
    delay(150); // 200→150
  }

  for(int i=0;i<4;i++){
    int tgt = getGripperForwardAngle(i);
    pca.setPWM(grippers[i],0,angleToPWM(tgt)); 
    delay(225); // 300→225
  }

  Serial.println("Pre-L' move positions achieved.");
}

void performLPrimeMove(int reps) {
  prepareForLPrimeMove();

  for(int r=0;r<reps;r++){
    Serial.print("L' (coordinated) #"); Serial.println(r+1);
    
    // Release left gripper: 10°
    pca.setPWM(grippers[LEFT_ARM],0,angleToPWM(GRIPPER_BACK)); 
    delay(225); // 300→225
    
    // Rotate left arm to horizontal: 175°
    pca.setPWM(rotators[LEFT_ARM],0,angleToPWM(175)); 
    delay(375); // 500→375
    
    // RIGHT GRIPPER: Now uses 155+4=159 instead of 153+6=159 (same result but different base)
    pca.setPWM(grippers[RIGHT_ARM],0,angleToPWM(159)); 
    delay(225); // 300→225
    
    // Left gripper: 148° (prepare for rotation)
    pca.setPWM(grippers[LEFT_ARM],0,angleToPWM(148)); 
    delay(225); // 300→225
    
    // Perform counterclockwise rotation: Left rotator to 84°
    pca.setPWM(rotators[LEFT_ARM],0,angleToPWM(84)); 
    delay(375); // 500→375
    
    // Return left rotator to vertical: 90°
    pca.setPWM(rotators[LEFT_ARM],0,angleToPWM(LEFT_ROT_VERT)); 
    delay(300); // 400→300
    
    // RIGHT GRIPPER: Now returns to 155 instead of 153
    pca.setPWM(grippers[RIGHT_ARM],0,angleToPWM(RIGHT_GRIP_FWD)); 
    delay(225); // 300→225
    
    // Left gripper: 155°
    pca.setPWM(grippers[LEFT_ARM],0,angleToPWM(LEFT_GRIP_FWD)); 
    delay(225); // 300→225
  }
  Serial.println("L' coordinated move complete.");
}

/* ───────────────────────────  B & B' MOVES - UPDATED WITH 99° ROTATION  ───────────────────────── */
void prepareForBMove() {
  Serial.println("Prep for B move (updated to spec)");
  
  // All arms vertical (F:88°, R:94°, B:88°, L:92°)
  for(int i = 0; i < 4; i++){
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i], 0, angleToPWM(vertAngle)); 
    delay(150); // 200→150
  }
  
  // All grippers forward (F:165°, R:155°, B:165°, L:155°) - RIGHT UPDATED
  for(int i = 0; i < 4; i++){
    int tgt = getGripperForwardAngle(i);
    pca.setPWM(grippers[i], 0, angleToPWM(tgt)); 
    delay(225); // 300→225
  }
  
  Serial.println("Pre-B move positions achieved.");
}

void performBMove(bool prime, int reps) {
  if (prime) {
    performBPrimeMove(reps);
    return;
  }
  
  prepareForBMove();
  
  for(int r = 0; r < reps; r++){
    Serial.print("B (updated to spec) #"); Serial.println(r + 1);
    
    // Release back gripper (10°)
    pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(GRIPPER_BACK)); 
    delay(225); // 300→225
    
    // Back rotator horizontal (0°)
    pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(HORIZONTAL_POS)); 
    delay(375); // 500→375
    
    // Adjust grips (Front:175°, Back:155°)
    pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(175)); 
    delay(225); // 300→225
    pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(155)); 
    delay(225); // 300→225
    
    // Rotate back arm (99°) - UPDATED FROM 96° TO 99°
    pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(99)); 
    delay(375); // 500→375
    
    // Return to vertical (88°)
    pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(getRotatorVerticalAngle(BACK_ARM))); 
    delay(300); // 400→300
    
    // Restore grips (Front:165°, Back:165°)
    pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(getGripperForwardAngle(FRONT_ARM))); 
    delay(225); // 300→225
    pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(getGripperForwardAngle(BACK_ARM))); 
    delay(225); // 300→225
  }
  Serial.println("B move complete - Ready");
}

void prepareForBPrimeMove() {
  Serial.println("Prep for B' move (updated to spec)");

  // All arms vertical (F:88°, R:94°, B:88°, L:92°)
  for(int i = 0; i < 4; i++){
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i], 0, angleToPWM(vertAngle)); 
    delay(150); // 200→150
  }

  // All grippers forward (F:165°, R:155°, B:165°, L:155°) - RIGHT UPDATED
  for(int i = 0; i < 4; i++){
    int tgt = getGripperForwardAngle(i);
    pca.setPWM(grippers[i], 0, angleToPWM(tgt)); 
    delay(225); // 300→225
  }

  Serial.println("Pre-B' move positions achieved.");
}

void performBPrimeMove(int reps) {
  prepareForBPrimeMove();

  for(int r = 0; r < reps; r++){
    Serial.print("B' (updated to spec) #"); Serial.println(r + 1);
    
    // Release back gripper (10°)
    pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(GRIPPER_BACK)); 
    delay(225); // 300→225
    
    // Back rotator horizontal (170°)
    pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(170)); 
    delay(375); // 500→375
    
    // Adjust grips (Front:175°, Back:155°)
    pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(175)); 
    delay(225); // 300→225
    pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(155)); 
    delay(225); // 300→225
    
    // Rotate back arm (82°) - UNCHANGED
    pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(82)); 
    delay(375); // 500→375
    
    // Return to vertical (88°)
    pca.setPWM(rotators[BACK_ARM], 0, angleToPWM(getRotatorVerticalAngle(BACK_ARM))); 
    delay(300); // 400→300
    
    // Restore grips (Front:165°, Back:165°)
    pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(getGripperForwardAngle(FRONT_ARM))); 
    delay(225); // 300→225
    pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(getGripperForwardAngle(BACK_ARM))); 
    delay(225); // 300→225
  }
  Serial.println("B' move complete - Ready");
}

/* ───────────────────────────  F & F' MOVES - UPDATED WITH RIGHT/LEFT GRIP ADJUSTMENT  ───────────────────────── */
void prepareForFMove() {
  Serial.println("Prep for F move (updated with right/left grip adjustment)");
  
  // All arms vertical (F:88°, R:94°, B:88°, L:92°)
  for(int i = 0; i < 4; i++){
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i], 0, angleToPWM(vertAngle)); 
    delay(150); // 200→150
  }
  
  // All grippers forward (F:165°, R:155°, B:165°, L:155°) - RIGHT UPDATED
  for(int i = 0; i < 4; i++){
    int tgt = getGripperForwardAngle(i);
    pca.setPWM(grippers[i], 0, angleToPWM(tgt)); 
    delay(225); // 300→225
  }
  
  Serial.println("Pre-F move positions achieved.");
}

void performFMove(bool prime, int reps) {
  if (prime) {
    performFPrimeMove(reps);
    return;
  }
  
  prepareForFMove();
  
  for(int r = 0; r < reps; r++){
    Serial.print("F (updated with grip adjustment) #"); Serial.println(r + 1);
    
    // Release front gripper (10°)
    pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(GRIPPER_BACK)); 
    delay(225); // 300→225
    
    // NEW STEP: Right gripper +7 forward position and left gripper -7 its forward position
    // Right gripper: 155+7=162°, Left gripper: 155-7=148°
    pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(162));
    delay(225);
    pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(148));
    delay(225);
    
    // Front rotator horizontal (0°)
    pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(HORIZONTAL_POS)); 
    delay(375); // 500→375
    
    // Adjust grips (Back:172°, Front:158°) - UPDATED
    pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(172)); 
    delay(225); // 300→225
    pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(158)); 
    delay(225); // 300→225
    
    // Rotate front arm (97°) - UPDATED FROM 95° TO 97°
    pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(97)); 
    delay(375); // 500→375
    
    // Return to vertical (88°)
    pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(getRotatorVerticalAngle(FRONT_ARM))); 
    delay(300); // 400→300
    
    // Restore grips (Back:165°, Front:165°, Right:155°, Left:155°) - UPDATED
    pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(getGripperForwardAngle(BACK_ARM))); 
    delay(225); // 300→225
    pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(getGripperForwardAngle(FRONT_ARM))); 
    delay(225); // 300→225
    pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(getGripperForwardAngle(RIGHT_ARM))); 
    delay(225); // 300→225
    pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(getGripperForwardAngle(LEFT_ARM))); 
    delay(225); // 300→225
  }
  Serial.println("F move complete - Ready");
}

void prepareForFPrimeMove() {
  Serial.println("Prep for F' move (updated with right/left grip adjustment)");

  // All arms vertical (F:88°, R:94°, B:88°, L:92°)
  for(int i = 0; i < 4; i++){
    int vertAngle = getRotatorVerticalAngle(i);
    pca.setPWM(rotators[i], 0, angleToPWM(vertAngle)); 
    delay(150); // 200→150
  }

  // All grippers forward (F:165°, R:155°, B:165°, L:155°) - RIGHT UPDATED
  for(int i = 0; i < 4; i++){
    int tgt = getGripperForwardAngle(i);
    pca.setPWM(grippers[i], 0, angleToPWM(tgt)); 
    delay(225); // 300→225
  }

  Serial.println("Pre-F' move positions achieved.");
}

void performFPrimeMove(int reps) {
  prepareForFPrimeMove();

  for(int r = 0; r < reps; r++){
    Serial.print("F' (updated with grip adjustment) #"); Serial.println(r + 1);
    
    // Release front gripper (10°)
    pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(GRIPPER_BACK)); 
    delay(225); // 300→225
    
    // NEW STEP: Right gripper +7 forward position and left gripper -7 its forward position
    // Right gripper: 155+7=162°, Left gripper: 155-7=148°
    pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(162));
    delay(225);
    pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(148));
    delay(225);
    
    // Front rotator horizontal (175°)
    pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(175)); 
    delay(375); // 500→375
    
    // Adjust grips (Back:172°, Front:158°) - UPDATED
    pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(172)); 
    delay(225); // 300→225
    pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(158)); 
    delay(225); // 300→225
    
    // Rotate front arm (79°) - UNCHANGED
    pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(79)); 
    delay(375); // 500→375
    
    // Return to vertical (88°)
    pca.setPWM(rotators[FRONT_ARM], 0, angleToPWM(getRotatorVerticalAngle(FRONT_ARM))); 
    delay(300); // 400→300
    
    // Restore grips (Back:165°, Front:165°, Right:155°, Left:155°) - UPDATED
    pca.setPWM(grippers[BACK_ARM], 0, angleToPWM(getGripperForwardAngle(BACK_ARM))); 
    delay(225); // 300→225
    pca.setPWM(grippers[FRONT_ARM], 0, angleToPWM(getGripperForwardAngle(FRONT_ARM))); 
    delay(225); // 300→225
    pca.setPWM(grippers[RIGHT_ARM], 0, angleToPWM(getGripperForwardAngle(RIGHT_ARM))); 
    delay(225); // 300→225
    pca.setPWM(grippers[LEFT_ARM], 0, angleToPWM(getGripperForwardAngle(LEFT_ARM))); 
    delay(225); // 300→225
  }
  Serial.println("F' move complete - Ready");
}

/* ───────────────────────────  MOVE PARSER  ───────────────────────── */
int faceToArmIndex(char f) {
  switch(toupper(f)) {
    case 'F': return FRONT_ARM;
    case 'L': return LEFT_ARM;
    case 'B': return BACK_ARM;
    case 'R': return RIGHT_ARM;
    case 'U': return 4;
    case 'D': return 5;
    default:  return -1;
  }
}

void adjustGripForMove(int arm) {
  int others[3], idx=0;
  for(int i=0;i<4;i++) if(i!=arm) others[idx++]=i;
  pca.setPWM(grippers[arm],0,angleToPWM(GRIPPER_BACK)); delay(225); // 300→225
  for(int j=0;j<3;j++){
    int a=others[j];
    int vertAngle = getRotatorVerticalAngle(a);
    pca.setPWM(rotators[a],0,angleToPWM(vertAngle)); delay(150); // 200→150
    int tgt = getGripperForwardAngle(a);
    pca.setPWM(grippers[a],0,angleToPWM(tgt)); delay(225); // 300→225
  }
}

// Enhanced executeMoves function with optimized inter-move delays
void executeMoves(String mv) {
  mv.trim(); mv.toUpperCase();
  
  if (!isValidMoveSequence(mv)) {
    Serial.println("Invalid move sequence - ignoring");
    return;
  }
  
  // Only initialize if cube is not already gripped
  if (!cubeIsGripped) {
    releaseAllArms(); 
    delay(750);  // 1000→750
    initialGripCube(); 
    delay(750); // 1000→750
    cubeIsGripped = true;
  }
  
  Serial.println("Moves:"+mv);
  
  for(int i = 0; i < mv.length(); i++){
    char m = mv[i];
    if(m == ' ') continue;
    
    bool prime = false; 
    int reps = 1;
    
    // Check for prime (apostrophe)
    if(i + 1 < mv.length() && mv[i + 1] == '\''){
      prime = true; 
      i++; // Skip the apostrophe
    }
    
    // Check for 2 (double move)
    if(i + 1 < mv.length() && mv[i + 1] == '2'){
      reps = 2; 
      i++; // Skip the 2
    }
    
    int arm = faceToArmIndex(m);
    if(arm == -1){ 
      Serial.print("Bad:"); Serial.println(m); 
      continue; 
    }
    
    // Debug output
    Serial.print("Executing: "); 
    Serial.print(m);
    if(prime) Serial.print("'");
    if(reps == 2) Serial.print("2");
    Serial.println();
    
    if(arm == RIGHT_ARM) {
      performRMove(prime, reps);
    }
    else if(arm == LEFT_ARM) {
      performLMove(prime, reps);
    }
    else if(arm == BACK_ARM) {
      performBMove(prime, reps);
    }
    else if(arm == FRONT_ARM) {
      performFMove(prime, reps);
    }
    else if(arm == 4) {
      performUMove(prime, reps);
    }
    else if(arm == 5) {
      performDMove(prime, reps);
    }
    
    // OPTIMIZED INTER-MOVE DELAY: Smart delay based on move complexity
    if(arm == 4 || arm == 5) {  // U or D moves (more complex)
      delay(COMPLEX_MOVE_DELAY);  // 150ms for complex moves
    } else {  // R, L, F, B moves (simpler)
      delay(SIMPLE_MOVE_DELAY);   // 75ms for simple moves
    }
  }
  Serial.println("Done all");
}

void processReceivedMoves(String moves) {
  Serial.println("✅ Moves received:");
  Serial.println(moves);
  
  executeMoves(moves);
  
  Serial.println("over");
}

/* ───────────────────────────  SETUP / LOOP  ──────────────────────── */
void setup(){
  Serial.begin(115200);
  delay(750); // 1000→750
  
  Serial.println("ESP32 READY");
  Serial.println("CUBOT READY");
  
  pca.begin(); 
  pca.setPWMFreq(50);
  delay(750); // 1000→750
  
  releaseAllArms(); 
  delay(1125); // 1500→1125
  
  Serial.println("READY");
}

void loop(){
  if (Serial.available()) {
    receivedMoves = Serial.readStringUntil('\n');
    receivedMoves.trim();
    
    String c = receivedMoves;
    c.toUpperCase();
    
    if(c.equals("PING")) {
      Serial.println("PONG");
      return;
    }
    else if(c.equals("STATUS")) {
      Serial.println("READY");
      return;
    }
    else if(c.equals("RELEASE")) {
      releaseAllArms();
      cubeIsGripped = false;  // Reset the flag
      return;
    }
    else if(c.equals("INIT") || c.equals("GRIP")) {  // Updated GRIP command
      delay(750); // 1000→750
      initialGripCube();  // Grip with all 4 arms
      delay(750); // 1000→750
      cubeIsGripped = true;
      Serial.println("All 4 arms gripping cube - ready for moves");
      return;
    }
    else if(c.equals("SCAN")) {
      performScan();
      return;
    }
    else if(c.equals("TEST")) {
      Serial.println("Testing all servos...");
      for(int i=0;i<8;i++){
        Serial.print("Testing servo "); Serial.println(i);
        pca.setPWM(i,0,angleToPWM(GRIPPER_BACK)); delay(375); // 500→375
        pca.setPWM(i,0,angleToPWM(HORIZONTAL_POS));  delay(375); // 500→375
        pca.setPWM(i,0,angleToPWM(159)); delay(375); // 500→375
        pca.setPWM(i,0,angleToPWM(90)); delay(375); // 500→375
      }
      Serial.println("Servo test complete");
      cubeIsGripped = false;  // Reset after test
      return;
    }
    
    if (isValidMoveSequence(receivedMoves)) {
      processReceivedMoves(receivedMoves);
    } else {
      Serial.println("Unknown command: " + receivedMoves);
    }
  }
}
