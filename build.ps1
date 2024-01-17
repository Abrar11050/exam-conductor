# install dependencies for the frontend, and build it
cd exco-frontend
npm install
npm run build
cd ..

# install dependencies for the backend
cd exco-backend
npm install
npm run build
cd ..

# copy the build directory
cp -r ./exco-frontend/build ./exco-backend/