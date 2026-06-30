#!/usr/bin/env bash
#
# Manual API tests for the justemicro services.
# Start everything first with:  pnpm dev   (or pnpm start)
#
# Usage:
#   ./test.sh           # run every request below
#   ./test.sh identity  # run only the identity section (identity|inventory|payment|booking)

set -u

IDENTITY="http://localhost:3001"
INVENTORY="http://localhost:3002"
PAYMENT="http://localhost:3003"
BOOKING="http://localhost:3004"

# Pretty-print: label, then the response with HTTP status appended.
req() {
  local label=$1; shift
  echo
  echo "### $label"
  echo "> curl $*"
  curl -s -w "\n[HTTP %{http_code}]\n" "$@"
}

filter="${1:-all}"

# ---------------------------------------------------------------------------
# IDENTITY  (:3001)
# ---------------------------------------------------------------------------
if [[ "$filter" == "all" || "$filter" == "identity" ]]; then
  echo "=========================================================="
  echo " IDENTITY SERVICE  ($IDENTITY)"
  echo "=========================================================="

  req "Get existing user (id 1 -> Alice)" \
    "$IDENTITY/users/1"

  req "Get another user (id 2 -> Bob)" \
    "$IDENTITY/users/2"

  req "Get non-existent user (expect 404)" \
    "$IDENTITY/users/999"
fi

# ---------------------------------------------------------------------------
# INVENTORY  (:3002)
# ---------------------------------------------------------------------------
if [[ "$filter" == "all" || "$filter" == "inventory" ]]; then
  echo
  echo "=========================================================="
  echo " INVENTORY SERVICE  ($INVENTORY)"
  echo "=========================================================="

  req "List all events" \
    "$INVENTORY/events"

  # Create a temporary reservation and capture its id for the next calls.
  echo
  echo "### Create temporary reservation for event 1"
  RESP=$(curl -s -X POST "$INVENTORY/events/1/reserve-temp")
  echo "$RESP"
  RES_ID=$(echo "$RESP" | grep -o '"reservationId":"[^"]*"' | cut -d'"' -f4)
  echo "captured reservationId = ${RES_ID:-<none>}"

  req "Confirm that reservation" \
    -X POST "$INVENTORY/reservations/${RES_ID}/confirm"

  # Make a second reservation so we have one to release.
  RESP2=$(curl -s -X POST "$INVENTORY/events/2/reserve-temp")
  RES_ID2=$(echo "$RESP2" | grep -o '"reservationId":"[^"]*"' | cut -d'"' -f4)

  req "Release a reservation (event 2)" \
    -X POST "$INVENTORY/reservations/${RES_ID2}/release"

  req "Reserve a non-existent event (expect 404)" \
    -X POST "$INVENTORY/events/999/reserve-temp"
fi

# ---------------------------------------------------------------------------
# PAYMENT  (:3003)
# ---------------------------------------------------------------------------
if [[ "$filter" == "all" || "$filter" == "payment" ]]; then
  echo
  echo "=========================================================="
  echo " PAYMENT SERVICE  ($PAYMENT)"
  echo "=========================================================="

  req "Accepted payment (known card, sufficient balance)" \
    -X POST "$PAYMENT/payment" \
    -H "Content-Type: application/json" \
    -d '{"amount": 1000, "card": {"number": "4111111111111111"}}'

  req "Refused: insufficient funds (amount > 5000 balance)" \
    -X POST "$PAYMENT/payment" \
    -H "Content-Type: application/json" \
    -d '{"amount": 9000, "card": {"number": "4111111111111111"}}'

  req "Refused: card not recognized" \
    -X POST "$PAYMENT/payment" \
    -H "Content-Type: application/json" \
    -d '{"amount": 100, "card": {"number": "4242424242424242"}}'

  req "Refused: amount exceeds limit (> 10000)" \
    -X POST "$PAYMENT/payment" \
    -H "Content-Type: application/json" \
    -d '{"amount": 20000, "card": {"number": "5500000000000004"}}'

  req "Refused: invalid amount" \
    -X POST "$PAYMENT/payment" \
    -H "Content-Type: application/json" \
    -d '{"amount": -5, "card": {"number": "4111111111111111"}}'

  req "Refused: invalid card number" \
    -X POST "$PAYMENT/payment" \
    -H "Content-Type: application/json" \
    -d '{"amount": 100, "card": {"number": "abc"}}'
fi

# ---------------------------------------------------------------------------
# BOOKING  (:3004)  -- orchestrator
# ---------------------------------------------------------------------------
if [[ "$filter" == "all" || "$filter" == "booking" ]]; then
  echo
  echo "=========================================================="
  echo " BOOKING SERVICE  ($BOOKING)"
  echo "=========================================================="
  echo "seatId is the inventory event id; paymentMethod is the card object."

  req "Missing required fields (expect 400)" \
    -X POST "$BOOKING/bookings" \
    -H "Content-Type: application/json" \
    -d '{"userId": 1}'

  req "Unknown user (expect 404 user_not_found)" \
    -X POST "$BOOKING/bookings" \
    -H "Content-Type: application/json" \
    -d '{"userId": 999, "seatId": 1, "amount": 1000, "paymentMethod": {"number": "4111111111111111"}}'

  req "Unknown seat/event (expect 409 seat_unavailable)" \
    -X POST "$BOOKING/bookings" \
    -H "Content-Type: application/json" \
    -d '{"userId": 1, "seatId": 999, "amount": 1000, "paymentMethod": {"number": "4111111111111111"}}'

  req "Payment refused: insufficient funds (expect 402, seat released)" \
    -X POST "$BOOKING/bookings" \
    -H "Content-Type: application/json" \
    -d '{"userId": 1, "seatId": 1, "amount": 9000, "paymentMethod": {"number": "4111111111111111"}}'

  # Capture a successful booking id, then fetch it back.
  echo
  echo "### Full successful booking (known user, available event, valid card)"
  BRESP=$(curl -s -X POST "$BOOKING/bookings" \
    -H "Content-Type: application/json" \
    -d '{"userId": 1, "seatId": 1, "amount": 1000, "paymentMethod": {"number": "4111111111111111"}}')
  echo "$BRESP"
  BOOKING_ID=$(echo "$BRESP" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  echo "captured bookingId = ${BOOKING_ID:-<none>}"

  req "Fetch that booking (expect 200, status confirmed)" \
    "$BOOKING/bookings/${BOOKING_ID}"

  req "Get a non-existent booking (expect 404)" \
    "$BOOKING/bookings/does-not-exist"
fi

echo
echo "Done."
