import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { Mermaid } from '@/components/Mermaid';
import React from 'react';

const DefaultPre = defaultMdxComponents.pre;

function PreWrapper(props: any) {
  const child = props?.children;

  // Direct pre check
  if (
    props?.['data-language'] === 'mermaid' ||
    (typeof props?.className === 'string' && props.className.includes('language-mermaid'))
  ) {
    const raw = typeof child === 'string' ? child : child?.props?.children;
    if (typeof raw === 'string') {
      return <Mermaid chart={raw} />;
    }
  }

  // Child code element check
  if (child && typeof child === 'object' && 'props' in child) {
    const codeProps = child.props;
    if (
      codeProps?.['data-language'] === 'mermaid' ||
      (typeof codeProps?.className === 'string' && codeProps.className.includes('language-mermaid'))
    ) {
      const raw = codeProps?.children;
      if (typeof raw === 'string') {
        return <Mermaid chart={raw} />;
      }
    }
  }

  if (DefaultPre) {
    return <DefaultPre {...props} />;
  }
  return <pre {...props} />;
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Mermaid,
    pre: PreWrapper,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}

export { Mermaid };
