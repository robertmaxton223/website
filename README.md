# Robert Maxton Site

Quick steps to deploy:

1. Put all files in a GitHub repository (root contains package.json, server.js, render.yaml, views/, public/).
2. Push to GitHub.
3. On Render: New -> Web Service -> Connect repo -> select branch -> Render will run `npm install` then `npm start`.
   - render.yaml included: mounts a disk at /data and sets env DATA_DIR=/data.
   - If Render rejects fractional disk (0.5), edit render.yaml `sizeGb` to `1` before importing.
4. Admin:
   - Login page: /admin/login
   - Default credentials:
     - Email: asadul43255@gmail.com
     - Password: 2344329040@a
   - From Admin you can create Blog / Video / Photo. Uploaded files are saved to /data/uploads and db at /data/db.json.

Notes:
- All site text uses Times New Roman.
- Header, top white bar, footer and layout follow your specifications.
- Visitor IPs are logged to DB; admin can view/delete/clear.
