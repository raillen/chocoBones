# Example: XSS Prevention in React

React (and similar modern frameworks like Vue and Angular) automatically handle output encoding, which prevents most standard Cross-Site Scripting (XSS) vulnerabilities. However, there are specific patterns where XSS is still possible.

## ❌ Vulnerable Pattern: dangerouslySetInnerHTML

This is the most common way to introduce XSS in React. It bypasses React's automatic encoding.

```jsx
import React from 'react';

function VulnerableComponent({ userBio }) {
  // If userBio contains `<img src=x onerror=alert('XSS') />`, it WILL execute.
  return (
    <div>
      <h3>User Bio</h3>
      <div dangerouslySetInnerHTML={{ __html: userBio }} />
    </div>
  );
}
```

## ✅ Secure Pattern: Sanitization with DOMPurify

If you absolutely must render raw HTML provided by a user (e.g., a rich text editor), you **must sanitize it** before rendering. `DOMPurify` is the industry standard library for this.

```jsx
import React from 'react';
import DOMPurify from 'dompurify';

function SecureComponent({ userBio }) {
  // DOMPurify strips out dangerous tags and attributes (like script tags and on* handlers)
  const cleanHtml = DOMPurify.sanitize(userBio);
  
  return (
    <div>
      <h3>User Bio</h3>
      <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
    </div>
  );
}
```

## ❌ Vulnerable Pattern: `javascript:` URIs

React does not automatically prevent `javascript:` URIs in `href` attributes (though newer versions log warnings).

```jsx
function VulnerableLink({ userWebsite }) {
  // If userWebsite is "javascript:alert(1)", clicking this link executes XSS.
  return (
    <a href={userWebsite}>Visit my website</a>
  );
}
```

## ✅ Secure Pattern: URL Protocol Validation

Always validate that dynamically generated URLs start with `http://` or `https://`.

```jsx
function SecureLink({ userWebsite }) {
  // Validate protocol
  const isValidUrl = userWebsite.startsWith('http://') || userWebsite.startsWith('https://');
  
  if (!isValidUrl) {
    return <span>Invalid URL provided</span>;
  }

  return (
    <a href={userWebsite}>Visit my website</a>
  );
}
```
