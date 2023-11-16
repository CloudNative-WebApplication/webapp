The server will start on port 8080 by default

The application provides the following routes:
GET /healthz: Check the health of the application and the database.
POST /assignments: Create a new assignment (requires authentication).
GET /assignments: Get all assignments for the authenticated user (requires authentication).
GET /assignments/:assignmentId: Get a specific assignment by ID (requires authentication).
PUT /assignments/:id: Update an assignment by ID (requires authentication).
DELETE /assignments/:id: Delete an assignment by ID (requires authentication).

Usage
To start the application, run:
npm install
npm start
