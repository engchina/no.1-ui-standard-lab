'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {AppShell} from '@astryxdesign/core/AppShell';
import {SideNav, SideNavHeading, SideNavItem} from '@astryxdesign/core/SideNav';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';

export function Providers({children}: {children: React.ReactNode}) {
  const path = usePathname();
  return (
    <Theme theme={neutralTheme}>
      <LinkProvider component={Link}>
        <AppShell
          sideNav={
            <SideNav header={<SideNavHeading heading="UI/UX 訓練場" subheading="Astryx で標準を作る" headingHref="/" />}>
              <SideNavItem label="問題一覧" href="/" isSelected={path === '/'} />
            </SideNav>
          }>
          {children}
        </AppShell>
      </LinkProvider>
    </Theme>
  );
}
