# NPM Commands Quick Reference

## 🚀 Development Commands

### Start Development Server
```bash
npm run dev
# or
npm start
```
- Starts Vite dev server at http://localhost:3000
- Hot Module Replacement (HMR) enabled
- Auto-reloads on file changes

## 🏗️ Build Commands

### Build for Production
```bash
npm run build
```
- Creates optimized production build
- Output: `dist/` directory
- Minified and optimized assets
- Ready for deployment

### Preview Production Build
```bash
npm run preview
# or
npm run serve
```
- Serves the production build locally
- Test before deployment
- Runs on http://localhost:4173 (default)

## 🧹 Cleaning Commands

### Clean Cache
```bash
npm run clean
```
- Removes `dist/` folder
- Removes `node_modules/.vite` cache
- Use when build issues occur

### Clean Everything
```bash
npm run clean:all
```
- Removes `dist/` folder
- Removes entire `node_modules/` folder
- ⚠️ Warning: Will need to reinstall dependencies

### Clean and Reinstall
```bash
npm run reinstall
```
- Runs `clean:all`
- Automatically reinstalls all dependencies
- Use when dependency issues occur

## 🔍 Code Quality (Placeholder)

### Linting
```bash
npm run lint
```
- Currently placeholder
- Add ESLint to enable linting

### Formatting
```bash
npm run format
```
- Currently placeholder
- Add Prettier to enable formatting

## 📦 Dependency Management

### Install Dependencies
```bash
npm install
# or
npm i
```

### Install Specific Package
```bash
npm install <package-name>
npm install <package-name> --save-dev
```

### Update Dependencies
```bash
npm update
```

### Check for Outdated Packages
```bash
npm outdated
```

### Audit Security
```bash
npm audit
npm audit fix
```

## 🎯 Common Workflows

### Fresh Start
```bash
npm run reinstall
npm run dev
```

### Deploy Workflow
```bash
npm run build
# Then upload dist/ folder to hosting
```

### Troubleshooting Build Issues
```bash
npm run clean
npm run build
```

### Complete Reset
```bash
npm run clean:all
npm install
npm run dev
```

## 💡 Tips

1. **Use `npm run dev` for development** - Fastest reload times
2. **Test with `npm run preview`** - Always preview production build before deployment
3. **Clean cache on weird errors** - `npm run clean` often fixes build issues
4. **Keep dependencies updated** - Run `npm outdated` periodically
5. **Use `npm run reinstall`** - When switching branches with different dependencies

## 🔧 Environment-Specific Commands

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

### CI/CD Pipeline
```bash
npm ci                    # Clean install
npm run lint             # Lint code (when configured)
npm run build            # Build project
```

## 📚 More Information

- Vite Documentation: https://vitejs.dev/
- npm Documentation: https://docs.npmjs.com/
- Project README: [README.md](./README.md)
- Features Documentation: [FEATURES.md](./FEATURES.md)
