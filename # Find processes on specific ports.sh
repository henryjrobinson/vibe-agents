# Find processes on specific ports
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN

# Kill process by PID (get PID from lsof output)
kill <PID>

# Kill all processes on a specific port (more aggressive)
lsof -ti:3000 | xargs kill
lsof -ti:3001 | xargs kill

# Force kill if regular kill doesn't work
kill -9 <PID>


# Status and basic operations
git status
git add .
git add <file>
git commit -m "message"
git push
git pull

git status
git add .
git commit -m "message"
git push
git pull
git diff

# Branch operations
git branch
git checkout <branch>
git checkout -b <new-branch>
git merge <branch>

# Viewing changes
git diff
git log --oneline
git show <commit-hash>

# Undoing changes
git reset --hard HEAD    # Discard all local changes
git reset HEAD~1         # Undo last commit (keep changes)
git checkout -- <file>   # Discard changes to specific file

npm start
# or on specific port:
PORT=3001 npm start