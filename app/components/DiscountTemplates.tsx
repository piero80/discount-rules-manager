/* eslint-disable react/prop-types */
import { useState } from "react";
import {
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Banner,
  Grid,
  Layout,
} from "@shopify/polaris";
import { TrendingUp, Calendar, Users, Target, Zap } from "lucide-react";

interface DiscountTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<unknown>;
  color: "success" | "critical";
  conditions: string[];
  benefits: string[];
  setupTime: string;
  popularity: "hot" | "trending" | "new" | null;
}

const DISCOUNT_TEMPLATES: DiscountTemplate[] = [
  {
    id: "black-friday",
    name: "Black Friday Mega Sale",
    description:
      "Sconto progressivo basato su quantità acquistate - più compri, più risparmi",
    icon: TrendingUp as React.ComponentType<unknown>,
    color: "critical",
    conditions: [
      "20% su ordini €50+",
      "30% su ordini €100+",
      "40% su ordini €200+",
    ],
    benefits: [
      "Aumenta AOV del 35%",
      "Riduce carrelli abbandonati",
      "Fidelizza clienti VIP",
    ],
    setupTime: "2 minuti",
    popularity: "hot",
  },
  {
    id: "bulk-discount",
    name: "Bulk Discount Pro",
    description:
      "Sconti automatici per acquisti in quantità - perfetto per B2B e grossisti",
    icon: Target as React.ComponentType<unknown>,
    color: "success",
    conditions: [
      "10% per 5+ prodotti",
      "15% per 10+ prodotti",
      "20% per 20+ prodotti",
    ],
    benefits: [
      "Incrementa vendite B2B",
      "Svuota magazzino veloce",
      "Margini ottimizzati",
    ],
    setupTime: "1 minuto",
    popularity: "trending",
  },
  {
    id: "vip-customer",
    name: "VIP Customer Rewards",
    description: "Sconti esclusivi per clienti fedeli e high-value customers",
    icon: Users as React.ComponentType<unknown>,
    color: "success",
    conditions: [
      "15% clienti registrati",
      "25% clienti ricorrenti",
      "35% top spenders",
    ],
    benefits: ["Retention +45%", "LTV aumentato", "Brand loyalty"],
    setupTime: "3 minuti",
    popularity: "new",
  },
  {
    id: "seasonal-flash",
    name: "Flash Sale Express",
    description:
      "Sconti urgenti a tempo limitato per creare FOMO e boost vendite",
    icon: Zap as React.ComponentType<unknown>,
    color: "success",
    conditions: [
      "25% primi 24 ore",
      "15% successivi 2 giorni",
      "10% ultima settimana",
    ],
    benefits: ["Vendite immediate", "Buzz sui social", "Database clienti"],
    setupTime: "30 secondi",
    popularity: "hot",
  },
  {
    id: "collection-boost",
    name: "Collection Booster",
    description:
      "Promuovi specifiche collezioni con sconti mirati e cross-selling",
    icon: Calendar as React.ComponentType<unknown>,
    color: "success",
    conditions: [
      "20% su nuovi arrivi",
      "30% su fine stagione",
      "Buy 2 Get 1 Free",
    ],
    benefits: ["Rotation inventory", "Cross-selling +30%", "Margini protetti"],
    setupTime: "2 minuti",
    popularity: "trending",
  },
];

interface TemplateCardProps {
  template: DiscountTemplate;
  onApply: (templateId: string) => void;
  isApplying: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onApply,
  isApplying,
}) => {
  const Icon = template.icon as React.ComponentType<{ size?: number }>;

  return (
    <Card>
      <BlockStack gap="400">
        {/* Header con Badge popularity */}
        <InlineStack align="space-between" blockAlign="start">
          <InlineStack gap="200" blockAlign="center">
            <div
              style={{
                padding: "8px",
                borderRadius: "8px",
                backgroundColor:
                  template.color === "success" ? "#e3f2fd" : "#ffebee",
              }}
            >
              <Icon size={20} />
            </div>
            <Text variant="headingMd" as="h3">
              {template.name}
            </Text>
          </InlineStack>

          {template.popularity && (
            <Badge
              tone={
                template.popularity === "hot"
                  ? "critical"
                  : template.popularity === "trending"
                    ? "success"
                    : "success"
              }
            >
              {template.popularity === "hot"
                ? "🔥 Hot"
                : template.popularity === "trending"
                  ? "📈 Trending"
                  : "✨ New"}
            </Badge>
          )}
        </InlineStack>

        {/* Description */}
        <Text variant="bodyMd" tone="subdued" as="p">
          {template.description}
        </Text>

        {/* Quick Setup Time */}
        <InlineStack gap="100" blockAlign="center">
          <div style={{ color: "#10b981", fontSize: "14px" }}>⏱️</div>
          <Text variant="bodySm" tone="success" as="span">
            Setup in {template.setupTime}
          </Text>
        </InlineStack>

        {/* Conditions */}
        <BlockStack gap="200">
          <Text variant="headingSm" as="h4">
            Condizioni:
          </Text>
          {template.conditions.map((condition, index) => (
            <InlineStack key={index} gap="100" blockAlign="center">
              <div style={{ color: "#00AA44", fontSize: "12px" }}>✓</div>
              <Text variant="bodySm" as="span">
                {condition}
              </Text>
            </InlineStack>
          ))}
        </BlockStack>

        {/* Benefits */}
        <BlockStack gap="200">
          <Text variant="headingSm" as="h4">
            Risultati attesi:
          </Text>
          {template.benefits.map((benefit, index) => (
            <InlineStack key={index} gap="100" blockAlign="center">
              <div style={{ color: "#007acc", fontSize: "12px" }}>💡</div>
              <Text variant="bodySm" tone="subdued" as="span">
                {benefit}
              </Text>
            </InlineStack>
          ))}
        </BlockStack>

        {/* Action Button */}
        <Button
          variant="primary"
          size="large"
          onClick={() => onApply(template.id)}
          loading={isApplying}
          tone={template.color}
        >
          Applica Template ({template.setupTime})
        </Button>
      </BlockStack>
    </Card>
  );
};

interface DiscountTemplatesProps {
  onTemplateApply: (templateId: string) => Promise<void>;
}

export const DiscountTemplates: React.FC<DiscountTemplatesProps> = ({
  onTemplateApply,
}) => {
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);

  const handleApplyTemplate = async (templateId: string) => {
    setApplyingTemplate(templateId);
    try {
      await onTemplateApply(templateId);
    } finally {
      setApplyingTemplate(null);
    }
  };

  return (
    <Layout>
      <Layout.Section>
        <BlockStack gap="500">
          {/* Header */}
          <Card>
            <BlockStack gap="300">
              <Text variant="headingXl" as="h1">
                🎯 Template di Sconto Pronti all&apos;Uso
              </Text>
              <Text variant="bodyLg" tone="subdued" as="p">
                Aumenta subito le vendite con template testati e ottimizzati.
                Ogni template è progettato per massimizzare conversioni e AOV.
              </Text>
              <Banner title="💎 Versione FREE" tone="info">
                <Text variant="bodySm" as="span">
                  Scegli 1 template gratuito. Per accesso illimitato e analytics
                  avanzati,
                  <Button variant="plain" url="#upgrade">
                    {" "}
                    upgrade a Pro →
                  </Button>
                </Text>
              </Banner>
            </BlockStack>
          </Card>

          {/* Templates Grid */}
          <Grid>
            {DISCOUNT_TEMPLATES.map((template) => (
              <Grid.Cell
                key={template.id}
                columnSpan={{ xs: 6, sm: 4, md: 4, lg: 4, xl: 4 }}
              >
                <TemplateCard
                  template={template}
                  onApply={handleApplyTemplate}
                  isApplying={applyingTemplate === template.id}
                />
              </Grid.Cell>
            ))}
          </Grid>

          {/* CTA Bottom */}
          <Card>
            <BlockStack gap="300">
              <Text variant="headingLg" as="h2">
                🚀 Non trovi quello che cerchi?
              </Text>
              <Text variant="bodyMd" as="p">
                Crea regole personalizzate, analizza performance e ottimizza
                automaticamente i tuoi sconti con la versione Pro.
              </Text>
              <InlineStack gap="200">
                <Button variant="primary" size="large">
                  Upgrade a Pro - €9.99/mese
                </Button>
                <Button variant="secondary" url="/app/rules">
                  Crea Regola Custom
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Layout.Section>
    </Layout>
  );
};
