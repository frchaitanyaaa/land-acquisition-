import type { ReactNode } from 'react';
import { ProjectHeader } from './project-header';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectHeader projectId={id}>{children}</ProjectHeader>;
}
