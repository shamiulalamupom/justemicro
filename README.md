# JusteMicro

Un petit projet de **microservices** avec Node.js et Express.
Il simule la réservation de places pour des événements.

## Les services

Il y a quatre services. Chaque service utilise son propre port.

| Service       | Port | Rôle                                          |
| ------------- | ---- | --------------------------------------------- |
| **identity**  | 3001 | Gère les utilisateurs.                         |
| **inventory** | 3002 | Gère les événements et les places.             |
| **payment**   | 3003 | Vérifie et accepte les paiements.              |
| **booking**   | 3004 | Coordonne les autres services pour réserver.   |

Le service **booking** appelle les trois autres services :
il vérifie l'utilisateur, réserve la place, demande le paiement,
puis confirme la réservation.

## Installation

Vous avez besoin de **Node.js** et de **pnpm**.

```bash
pnpm install
```

## Démarrer les services

Pour lancer **tous les services** en même temps :

```bash
pnpm dev      # avec nodemon (redémarre quand vous modifiez le code)
pnpm start    # avec node (sans redémarrage automatique)
```

Chaque service affiche ses messages avec une couleur et un nom différents.
Si un service s'arrête, les autres s'arrêtent aussi.

Pour lancer **un seul service** :

```bash
pnpm dev:identity     # ou dev:inventory, dev:payment, dev:booking
pnpm start:identity   # ou start:inventory, start:payment, start:booking
```

## Tester l'API

Quand les services sont démarrés, vous pouvez tester avec le script `test.sh` :

```bash
./test.sh             # teste tous les services
./test.sh identity    # teste un seul service (identity, inventory, payment ou booking)
```

Le script utilise `curl`. Il affiche la requête, la réponse et le code HTTP.

### Exemple : créer une réservation

```bash
curl -X POST http://localhost:3004/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "seatId": 1,
    "amount": 1000,
    "paymentMethod": { "number": "4111111111111111" }
  }'
```

- `seatId` est l'identifiant de l'événement dans **inventory**.
- `paymentMethod` est la carte envoyée à **payment**.

Si tout est correct, la réponse est :

```json
{ "id": "...", "status": "confirmed" }
```

### Cartes de test

| Numéro de carte    | Solde   |
| ------------------ | ------- |
| 4111111111111111   | 5000    |
| 5500000000000004   | 15000   |

Si le paiement est refusé (par exemple, montant trop grand),
**booking** libère la place automatiquement.
