# LKD Classes Release Checklist

## 1) Environment
- Verify `.env.local` has valid values:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
- Confirm production Supabase project URL/key are used for release build.

## 2) Code Quality
- Run:
```bash
npm run lint
npx tsc --noEmit
```
- Ensure no errors.

## 3) App Build Config
- Check `app.json`:
- `android.package` is final production package id.
- `version` incremented for release.
- `icon` and `adaptiveIcon` point to final logo assets.
- Check `eas.json` profile:
- APK profile for testing exists (`lkdclasses`).
- Add AAB profile for Play Store if needed.

## 4) Build Artifacts
- Login to EAS:
```bash
npx eas login
```
- Build test APK:
```bash
npx eas build -p android --profile lkdclasses
```
- Build Play Store AAB (recommended profile name `production`):
```bash
npx eas build -p android --profile production
```

## 5) Core Functional QA
- Auth:
- Signup works.
- Duplicate phone shows correct message.
- Login is fast and routes correctly.
- Logout is instant.
- Teacher:
- Dashboard loads from cache + refresh.
- Students list, edit, access status updates.
- Class/subject/chapter flow works.
- Lecture/material upload flows work.
- Notices CRUD works.
- Student:
- Home loads without blink.
- Subscription lock states correct.
- Material and lecture open correctly.
- Video player supports YouTube + direct links.
- Payment:
- No in-app payment UI that violates Play policy.
- Status/notice-only messaging in app is compliant.

## 6) Performance QA
- Cold open under slow network.
- No white flash between tab/page transitions.
- Low-data mode:
- Cached data visible first.
- Revalidate happens in background.
- Verify large lists still scroll smoothly.

## 7) Policy and Security
- No secrets hardcoded in code.
- No server/service-role keys shipped in app.
- Contact and support links valid.
- Privacy policy URL and support email ready for Play Console listing.

## 8) Store Submission Assets
- App name, short description, full description.
- Icon (512x512), feature graphic, screenshots.
- Privacy policy URL.
- Target audience/content declarations completed.

## 9) Final Smoke Test (Release Build)
- Install release APK on real Android device.
- Test:
- Login/signup/logout
- Teacher upload flow
- Student lecture playback
- Notice updates
- Offline banner behavior

## 10) Release Notes
- Maintain `CHANGELOG.md` or version notes.
- Include:
- Performance improvements
- Auth flow fixes
- Video playback fixes
- UI polish updates

