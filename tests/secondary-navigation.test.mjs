import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { hasPasswordCredential } from '../lib/password-auth.ts';

const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync('app/SecondaryShell.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function navigation(component = 'default') {
  let signedIn;
  let listener;
  let cleanup;
  let unsubscribed = false;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === 'react') return {
        useState(initial) {
          signedIn ??= initial;
          return [signedIn, value => { signedIn = value; }];
        },
        useEffect(effect) { cleanup ??= effect(); },
      };
      if (name === '@/lib/password-auth') return { hasPasswordCredential };
      if (name === '@/lib/supabase') return {
        supabase: { auth: { onAuthStateChange(callback) {
          listener = callback;
          return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
        } } },
      };
      return require(name);
    },
  });
  return {
    render: () => renderToStaticMarkup(exports[component]({ active: 'about', children: 'Public About content' })),
    session: (event, session) => listener(event, session),
    unmount: () => cleanup(),
    get unsubscribed() { return unsubscribed; },
  };
}

function assertGuest(html) {
  assert.match(html, /<span>Sign in<\/span>/);
  assert.match(html, /href="\/about"/);
  for (const label of ['Home', 'Contributions', 'Schools', 'Projects', 'Profile', 'Sports']) {
    assert.ok(!html.includes('<span>' + label + '</span>'), label + ' must be hidden while signed out');
  }
  assert.ok(!html.includes('href="/?view=profile"'));
}

test('public About keeps account links hidden before and after session initialization', () => {
  const nav = navigation();
  assertGuest(nav.render());
  nav.session('INITIAL_SESSION', { user: { id: 'setup-only-session', app_metadata: {} } });
  assertGuest(nav.render());
  nav.session('INITIAL_SESSION', null);
  const html = nav.render();
  assertGuest(html);
  assert.ok(html.includes('Public About content'));
  assert.ok(html.includes('grid-template-columns:repeat(2,1fr)'));
  nav.unmount();
  assert.equal(nav.unsubscribed, true);
});

test('restored sessions reveal both menus and sign-out removes account links immediately', () => {
  const nav = navigation();
  nav.render();
  const session = { user: { id: 'signed-in-user', app_metadata: { credential_version: 'password_v2' } } };
  nav.session('INITIAL_SESSION', session);
  for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED']) {
    nav.session(event, session);
    const html = nav.render();
    for (const label of ['Home', 'Contributions', 'Schools', 'Projects', 'Profile', 'Sports', 'About']) {
      assert.equal(html.split('<span>' + label + '</span>').length - 1, 2, label + ' must appear in both menus');
    }
    assert.ok(!html.includes('<span>Sign in</span>'));
  }
  nav.session('SIGNED_OUT', null);
  assertGuest(nav.render());
});

test('standalone mobile navigation follows the same sign-in and sign-out behaviour', () => {
  const nav = navigation('SecondaryMobileNavigation');
  assertGuest(nav.render());
  nav.session('SIGNED_IN', { user: { id: 'signed-in-user', app_metadata: { credential_version: 'password_v2' } } });
  const html = nav.render();
  assert.ok(html.includes('href="/?view=profile"'));
  assert.ok(html.includes('grid-template-columns:repeat(7,1fr)'));
  nav.session('SIGNED_OUT', null);
  assertGuest(nav.render());
});
