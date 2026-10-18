import type { ComponentProps, ReactNode } from 'react';
import { BUILDER_TEXT, useTranslation } from '@i18n';
import { JsonTransfer, SampleSelect } from './VisualAuthoringToolbar';
import { VisualSpecStorageBar } from './VisualSpecStorageBar';
import styles from './SpecFileTools.module.css';

type StorageProps = ComponentProps<typeof VisualSpecStorageBar>;

interface SpecFileToolsProps extends StorageProps {
  samples: Array<{ id: string; label: string }>;
  onLoadSample: (id: string) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  publish: ReactNode;
}

// A lecture is saved from its own row; the project menu only exists for standalone specs.
export function SpecFileTools({ samples, onLoadSample, onExport, onImportFile, publish, ...storage }: SpecFileToolsProps) {
  const { val } = useTranslation();
  return (
    <div className={styles.menu}>
      <section className={styles.section} aria-label={val(BUILDER_TEXT.cvSectionLocal)}>
        <h3 className={styles.heading}>{val(BUILDER_TEXT.cvSectionLocal)}</h3>
        <VisualSpecStorageBar {...storage} />
        <SampleSelect samples={samples} onLoadSample={onLoadSample} />
      </section>
      <section className={styles.section} aria-label={val(BUILDER_TEXT.cvSectionPublish)}>
        <h3 className={styles.heading}>{val(BUILDER_TEXT.cvSectionPublish)}</h3>
        {publish}
      </section>
      <section className={styles.section} aria-label={val(BUILDER_TEXT.cvSectionTransfer)}>
        <h3 className={styles.heading}>{val(BUILDER_TEXT.cvSectionTransfer)}</h3>
        <JsonTransfer onExport={onExport} onImportFile={onImportFile} />
      </section>
    </div>
  );
}
