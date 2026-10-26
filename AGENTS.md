# AGENTS.md

## Project
CourtBook: a learning project for microservices + agent-assisted development.
Services: auth-service, venue-service, booking-service, gateway. Frontend: Angular.

## Commands (per service, run from its folder)
- Install: npm ci
- Test: npm test
- Dev: npm run dev

## Conventions
- Each service owns its own MongoDB database. Never share a DB connection across services.
- booking-service must validate JWTs itself; it must never call auth-service's database directly.
- booking-service must never call venue-service's database directly. Use an HTTP call to venue-service's API to fetch court details.
- All inter-service calls go through explicit HTTP calls (axios), never direct imports across service folders.
- Angular frontend calls ONLY the gateway (localhost:3000), never a service directly.
- Services communicate asynchronously only through RabbitMQ events (exchange "courtbook.events", routing keys like "booking.confirmed"). Never share code between services.
- Publishing an event must never make a request fail after the database change has succeeded; log a short message instead.
- RabbitMQ URLs come from RABBITMQ_URL in .env. Never log credentials.

## Third-party integrations
- Geoapify API key lives in venue-service/.env as GEOAPIFY_API_KEY. Never commit it.
- Razorpay keys live in booking-service/.env as RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET. Use TEST mode keys only during development.
- Every Razorpay webhook handler MUST verify the webhook signature before trusting the payload.

## Never
- Never create a new MongoDB connection per request. Create one Mongoose connection at startup in src/db.js and reuse it.
- Never hard-code API keys, database URIs, or JWT secrets. Use .env files (see .env.example).
- Never commit .env or real API keys.
- Never mark a booking "confirmed" without a verified Razorpay webhook signature.

## Frontend
- Frontend (frontend/): the Angular app calls ONLY the gateway at http://localhost:3000, never a service directly. Standalone components, strict TypeScript, no `any`.
- Never put secrets in the frontend. The Razorpay key id comes from the API response; the Razorpay key secret and webhook secret never appear in frontend code.
- The frontend never marks a booking as confirmed; only the webhook does. After payment it re-fetches the booking and shows its real status.