import React from 'react';

const Link = ({url}) => {
  if (window.JSDOM_HOOK != null) {
    return url;
  }
  return <a href={url}>{url}</a>;
};

export { Link };
