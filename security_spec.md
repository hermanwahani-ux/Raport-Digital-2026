# Security Specifications: Portal Raport Digital

This document lays out the security design invariants and malicious threat models considered for the **Portal Raport Digital** database operations.

## 1. Data Invariants

1. **Teacher Profiles (`profiles/{profileId}`)**:
   - Must be linked precisely to the teacher's User ID (`request.auth.uid == profileId`).
   - The primary school email must be immutable once configured.
   - Users cannot arbitrary set or change their system role to "Administrator" unless verified.

2. **Student Database (`students/{studentId}`)**:
   - Registering a student is restricted exclusively to authenticated educators.
   - Student IDs and NISN IDs cannot be spoofed, blank, or poisoned with multi-megabyte payloads.
   - NISN must strictly consist of numeric sequences (10 digits).

3. **Announcements board (`announcements/{id}`)**:
   - Creating or editing broadcast messages is strictly limited to authenticated teachers.
   - Anyone authenticated (including students/parents) can view the public broadcast files.

4. **Grades Engine (`grades/{id}`)**:
   - Only authenticated educators can push, edit, or delete grades records.
   - A student can securely fetch their own scorecard (`resource.data.studentId == request.auth.uid` or matches verified student records). No student can read another classmate's score.

5. **Attendance Register (`attendance/{id}`)**:
   - Educators are the absolute source of truth. Students have no permit to edit attendance statuses or self-certify as present.

6. **Uploaded Reports Store (`uploadedReports/{id}`)**:
   - Educator credentials required to sync, backup, write, or override report entries.
   - PDF data stored as Base64 must only be read by the designated student (`resource.data.studentId == request.auth.uid`) or the uploading educator.

---

## 2. The "Dirty Dozen" Threat Payloads

The following malicious attempt scenarios must return a strict `PERMISSION_DENIED` rejection on the Firestore gate:

1. **Self-Elevating Role Attack (Identity Modification)**
   - *Target*: `profiles/attacker_user_id`
   - *Payload*: `{ name: "Hacker", email: "hacker@sch.id", role: "SuperAdmin" }`
   - *Expectation*: Rejected. Only authenticated owner profile matches can update, and role fields are protected.

2. **Ghost-Field Injection on Profile Update**
   - *Target*: `profiles/legit_teacher_id`
   - *Payload*: `{ className: "X-IPA", isSystemAdmin: true }` (where `isSystemAdmin` is a shadow field)
   - *Expectation*: Rejected due to `affectedKeys()` strict white-list validator.

3. **Spoofed Email Update**
   - *Target*: `profiles/teacher_id`
   - *Payload*: `{ email: "another_teacher@sch.id" }`
   - *Expectation*: Rejected. Primary email fields are immutable.

4. **Poisoned Student Identity Injection (String Exploits)**
   - *Target*: `students/crafted_id_with_utf_or_huge_size`
   - *Payload*: String over 128 chars or special Unicode injections for ID paths.
   - *Expectation*: Stopped by `isValidId()` path parameter size check.

5. **Student Self-Registration Hijacking**
   - *Target*: `students/student-123`
   - *Payload*: `{ name: "A Nakal", nisn: "0000000000", gender: "Laki-laki", className: "XI-IPS" }` with `request.auth.uid` pointing to an unverified student account.
   - *Expectation*: Permitted only to educators.

6. **Spoofing Student Primary ID**
   - *Target*: `students/student-999`
   - *Payload*: `{ id: "student-100", name: "Spam User", ... }` where body ID mismatches target path ID.
   - *Expectation*: Mismatched document keys fail schema validation.

7. **Malicious Broadcast Hijack**
   - *Target*: `announcements/announce-abc`
   - *Payload*: `{ title: "Malicious Broadcast", content: "Click here to download phishing...", category: "urgent", targetAudience: "semana", date: "2026-06-11" }`
   - *Expectation*: Blocked since write permission belongs to verified educators.

8. **Direct Grade Sabotage (Cheat Attempt)**
   - *Target*: `grades/std-1`
   - *Payload*: `{ subjects: { math: 100 } }` sent by `request.auth.uid == "std-1"`.
   - *Expectation*: Rejected. Students have no write rights on grades.

9. **Spying on Classmate Grades**
   - *Target*: Read query `grades/classmate-id`
   - *Payload*: Authenticated student `std-1` attempting to GET grade card of `classmate-id`.
   - *Expectation*: Blocked by strict query boundary verification `resource.data.studentId == request.auth.uid`.

10. **Malicious Attendance Adjustment (Faking Attendance)**
    - *Target*: `attendance/att-std-1`
    - *Payload*: `{ status: "Hadir" }` written by `std-1`.
    - *Expectation*: Stopped. Writes restricted to teacher accounts only.

11. **Shadow PDF Replacement Attack**
    - *Target*: `uploadedReports/reportX`
    - *Payload*: Overwriting an existing secure PDF reference of a student by a random student peer.
    - *Expectation*: Rejected due to educator-only write check.

12. **Denial of Wallet (Huge String Storage Attack)**
    - *Target*: Any entity write containing over-sized body parameters.
    - *Payload*: Custom profile or Student entry containing megabytes of character sequences.
    - *Expectation*: Rejected. Validation functions enforce rigorous length boundaries (`field.size() <= MAX`).
