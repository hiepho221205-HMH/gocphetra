const fs = require('fs');
const path = require('path');

const appPath = path.resolve(__dirname, '../src/App.jsx');
let content = fs.readFileSync(appPath, 'utf8');

if (!content.includes('if (loginSuccessRole)')) {
  const isCrlf = content.includes('\r\n');
  const nl = isCrlf ? '\r\n' : '\n';

  const target = `  if (!isAuthenticated) {`;
  const addition = [
    `  if (loginSuccessRole) {`,
    `    return (`,
    `      <ErrorBoundary>`,
    `        <Suspense fallback={`,
    `          <div className="h-[100dvh] w-full bg-[#F8FAF7] flex items-center justify-center font-sans">`,
    `            <div className="w-12 h-12 rounded-full border-3 border-[#214E34] border-t-transparent animate-spin" />`,
    `          </div>`,
    `        }>`,
    `          <LoginSuccessView`,
    `            role={loginSuccessRole}`,
    `            user={currentUser}`,
    `            onContinue={() => {`,
    `              setLoginSuccessRole(null);`,
    `              navigate('/tables');`,
    `            }}`,
    `          />`,
    `        </Suspense>`,
    `      </ErrorBoundary>`,
    `    );`,
    `  }`,
    ``,
    `  if (!isAuthenticated) {`
  ].join(nl);

  if (content.includes(target)) {
    content = content.replace(target, addition);
    fs.writeFileSync(appPath, content, 'utf8');
    console.log('Successfully patched App.jsx with LoginSuccessView render block');
  } else {
    console.error('Target string not found in App.jsx');
  }
} else {
  console.log('App.jsx already has if (loginSuccessRole)');
}
