import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import type { PdfDocumentOptions, PdfSection } from './types';
import { pdfStyles as s, BRAND_COLORS } from './styles';

function Header({ options }: { options: PdfDocumentOptions }) {
  const { branding, title, generatedDate } = options;
  const addressParts = [branding.address, branding.city, branding.state, branding.zipCode].filter(Boolean);
  const addressLine = addressParts.join(', ');
  const contactParts = [branding.phone && `Tel: ${branding.phone}`, branding.fax && `Fax: ${branding.fax}`].filter(Boolean);

  return (
    <View style={s.header} fixed>
      <View style={s.headerLeft}>
        {branding.logoUrl && (
          <Image style={s.headerLogo} src={branding.logoUrl} />
        )}
        <View>
          <Text style={s.headerPracticeName}>{branding.practiceName}</Text>
          {addressLine && <Text style={s.headerAddress}>{addressLine}</Text>}
          {contactParts.length > 0 && <Text style={s.headerAddress}>{contactParts.join(' | ')}</Text>}
        </View>
      </View>
      <View style={s.headerRight}>
        <Text style={s.headerTitle}>{title}</Text>
        <Text style={s.headerDate}>{generatedDate || new Date().toLocaleDateString()}</Text>
      </View>
    </View>
  );
}

function Footer({ options }: { options: PdfDocumentOptions }) {
  const { branding, confidentialityNotice, footerText } = options;

  return (
    <View style={s.footer} fixed>
      <View>
        {confidentialityNotice && (
          <Text style={s.footerConfidential}>CONFIDENTIAL - Protected Health Information</Text>
        )}
        <Text style={s.footerText}>{footerText || branding.practiceName}</Text>
      </View>
      {options.showPageNumbers !== false && (
        <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      )}
    </View>
  );
}

function PatientBar({ options }: { options: PdfDocumentOptions }) {
  if (!options.patientName) return null;

  return (
    <View style={s.patientBar}>
      <Text style={s.patientBarItem}>
        <Text style={s.patientBarLabel}>Patient: </Text>{options.patientName}
      </Text>
      {options.patientDob && (
        <Text style={s.patientBarItem}>
          <Text style={s.patientBarLabel}>DOB: </Text>{options.patientDob}
        </Text>
      )}
      {options.providerName && (
        <Text style={s.patientBarItem}>
          <Text style={s.patientBarLabel}>Provider: </Text>{options.providerName}
        </Text>
      )}
      <Text style={s.patientBarItem}>
        <Text style={s.patientBarLabel}>Date: </Text>{options.generatedDate || new Date().toLocaleDateString()}
      </Text>
    </View>
  );
}

function SectionRenderer({ section }: { section: PdfSection }) {
  switch (section.type) {
    case 'heading': {
      const style = section.level === 1 ? s.h1 : section.level === 3 ? s.h3 : s.h2;
      return <Text style={style}>{section.text}</Text>;
    }
    case 'paragraph': {
      const highlightStyle = section.highlight === 'warning'
        ? s.paragraphWarning
        : section.highlight === 'critical'
          ? s.paragraphCritical
          : section.highlight === 'success'
            ? s.paragraphSuccess
            : undefined;
      return (
        <View style={highlightStyle}>
          <Text style={s.paragraph}>{section.text}</Text>
        </View>
      );
    }
    case 'list':
      return (
        <View>
          {(section.items || []).map((item, i) => (
            <View key={i} style={s.listItem}>
              <Text style={s.listBullet}>{section.ordered ? `${i + 1}.` : '\u2022'}</Text>
              <Text style={s.listText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'table':
      return (
        <View style={s.tableContainer}>
          {section.headers && (
            <View style={s.tableHeaderRow}>
              {section.headers.map((h, i) => (
                <Text key={i} style={s.tableHeaderCell}>{h}</Text>
              ))}
            </View>
          )}
          {(section.rows || []).map((row, ri) => (
            <View key={ri} style={[s.tableRow, ri % 2 === 1 ? s.tableAltRow : {}]}>
              {row.map((cell, ci) => (
                <Text key={ci} style={s.tableCell}>{cell}</Text>
              ))}
            </View>
          ))}
        </View>
      );
    case 'keyValue':
      return (
        <View style={s.kvContainer}>
          {(section.pairs || []).map((pair, i) => (
            <View key={i} style={s.kvRow}>
              <Text style={s.kvLabel}>{pair.label}</Text>
              <Text style={s.kvValue}>{pair.value}</Text>
            </View>
          ))}
        </View>
      );
    case 'divider':
      return <View style={s.divider} />;
    case 'spacer':
      return <View style={[s.spacer, section.height ? { height: section.height } : {}]} />;
    case 'signature':
      return (
        <View style={s.signatureBlock}>
          <View style={s.signatureLine} />
          {section.signerName && <Text style={s.signatureName}>{section.signerName}</Text>}
          {section.signerTitle && <Text style={s.signatureTitle}>{section.signerTitle}</Text>}
          {section.signedAt && <Text style={s.signatureDate}>Signed: {section.signedAt}</Text>}
        </View>
      );
    case 'image':
      if (!section.imageUrl) return null;
      return (
        <View style={s.imageContainer}>
          <Image
            style={[
              s.image,
              section.imageWidth ? { width: section.imageWidth } : {},
              section.imageHeight ? { height: section.imageHeight } : {},
            ]}
            src={section.imageUrl}
          />
          {section.imageCaption && (
            <Text style={s.imageCaption}>{section.imageCaption}</Text>
          )}
        </View>
      );
    default:
      return null;
  }
}

export function PdfDocumentComponent({ options }: { options: PdfDocumentOptions }) {
  return (
    <Document>
      <Page size="A4" style={s.page} orientation={options.orientation || 'portrait'}>
        <Header options={options} />
        <PatientBar options={options} />
        {options.subtitle && (
          <Text style={{ fontSize: 11, color: BRAND_COLORS.textLight, marginBottom: 10 }}>
            {options.subtitle}
          </Text>
        )}
        {options.sections.map((section, i) => (
          <SectionRenderer key={i} section={section} />
        ))}
        <Footer options={options} />
      </Page>
    </Document>
  );
}
