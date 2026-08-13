# Shideep Security Rules

These enforce SEC requirements from the PRD/SAD server-side — the client-side
`AUTHORIZED_EMAILS` check in `auth.js` is UX only and can't be trusted alone.

Deploy with the Firebase CLI:
```
firebase deploy --only firestore:rules,storage:rules
```

---

## firestore.rules

Save as `firestore.rules` in your project root, referenced from `firebase.json`.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthorized() {
      return request.auth != null &&
        request.auth.token.email in [
          'rajputmandeep931@gmail.com',
          'dass27296@gmail.com'
        ];
    }

    // Every collection: only the two whitelisted users may read or write.
    // No public, no anonymous, no third-party access — ever.
    match /{document=**} {
      allow read, write: if isAuthorized();
    }

    // Extra guard: a user may only ever write their own uid-keyed profile doc.
    match /users/{uid} {
      allow write: if isAuthorized() && request.auth.uid == uid;
    }
  }
}
```

---

## storage.rules

Save as `storage.rules` in your project root.

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    function isAuthorized() {
      return request.auth != null &&
        request.auth.token.email in [
          'rajputmandeep931@gmail.com',
          'dass27296@gmail.com'
        ];
    }

    match /{allPaths=**} {
      allow read, write: if isAuthorized()
        && request.resource.size < 8 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## Notes

- The email allowlist is duplicated in three places on purpose: `config.js`
  (client UX), `firestore.rules`, and `storage.rules` (real enforcement).
  If you ever change an email address, update all three.
- `firestore.rules` here is intentionally coarse (any authorized user can
  touch any document) to match the PRD's "two-person shared home" model —
  there's no per-document ownership to enforce since both users share
  everything. Tighten later only if you introduce per-user private data.
- Test rules before deploying: `firebase emulators:start` +
  `@firebase/rules-unit-testing`.
