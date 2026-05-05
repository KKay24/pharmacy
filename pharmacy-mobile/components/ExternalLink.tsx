import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Platform } from 'react-native';

type ExternalLinkProps = React.ComponentProps<typeof Link>;

export function ExternalLink(props: ExternalLinkProps) {
  const href = props.href;

  return (
    <Link
      target="_blank"
      {...props}
      href={href}
      onPress={(e) => {
        if (Platform.OS !== 'web' && typeof href === 'string') {
          // Prevent the default behavior of linking to the default browser on native.
          e.preventDefault();
          // Open the link in an in-app browser.
          WebBrowser.openBrowserAsync(href);
        }
      }}
    />
  );
}
