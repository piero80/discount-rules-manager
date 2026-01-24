import { useState, useCallback } from "react";
import {
  Card,
  Button,
  TextField,
  ResourceList,
  ResourceItem,
  Text,
  BlockStack,
  InlineStack,
  Tag,
  ChoiceList,
  Select,
  Checkbox,
  Banner,
  Badge,
  Divider,
} from "@shopify/polaris";

interface Collection {
  id: string;
  title: string;
  productsCount: number;
}

interface Rule {
  id: string;
  name: string;
  description?: string;
  mode: "exclude" | "include";
  priority: number;
  active: boolean;
  isScheduled: boolean;
  scheduledStart?: string;
  scheduledEnd?: string;
  excludedCollections: Array<{
    id: string;
    title: string;
    productsCount: number;
  }>;
}

interface RuleFormProps {
  rule?: Rule | null; // Per editing
  collections: Collection[];
  onSave: (formData: FormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  maxPriority: number;
  planLimit?: {
    current: number;
    max: number;
    planName: string;
  };
}

export function RuleForm({
  rule,
  collections,
  onSave,
  onCancel,
  isLoading = false,
  maxPriority,
  planLimit,
}: RuleFormProps): JSX.Element {
  const isEditing = Boolean(rule);
  // TODO: Temporarily disable plan limits during development
  const isAtLimit = false;
  // const isAtLimit =
  //   planLimit && planLimit.current >= planLimit.max && !isEditing;

  // Form state
  const [name, setName] = useState(rule?.name || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [selectedMode, setSelectedMode] = useState<string[]>([
    rule?.mode || "exclude",
  ]);
  const [priority, setPriority] = useState(
    rule?.priority?.toString() || (maxPriority + 1).toString(),
  );
  const [active, setActive] = useState(rule?.active ?? true);
  const [isScheduled, setIsScheduled] = useState(rule?.isScheduled || false);
  const [scheduledStart, setScheduledStart] = useState(
    rule?.scheduledStart ? rule.scheduledStart.split("T")[0] : "",
  );
  const [scheduledEnd, setScheduledEnd] = useState(
    rule?.scheduledEnd ? rule.scheduledEnd.split("T")[0] : "",
  );
  const [selectedCollections, setSelectedCollections] = useState<Collection[]>(
    rule?.excludedCollections || [],
  );
  const [searchValue, setSearchValue] = useState("");

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentMode = selectedMode[0] || "exclude";
  const isExcludeMode = currentMode === "exclude";

  // Filter collections based on search and exclude already selected
  const filteredCollections = collections.filter(
    (collection: Collection) =>
      collection.title.toLowerCase().includes(searchValue.toLowerCase()) &&
      !selectedCollections.some((selected) => selected.id === collection.id),
  );

  // Priority options
  const priorityOptions = Array.from({ length: maxPriority + 2 }, (_, i) => ({
    label: i === 0 ? "Highest (0)" : i.toString(),
    value: i.toString(),
  }));

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Rule name is required";
    }

    if (!priority) {
      newErrors.priority = "Priority is required";
    }

    if (isScheduled) {
      if (!scheduledStart) {
        newErrors.scheduledStart =
          "Start date is required when scheduling is enabled";
      }
      if (!scheduledEnd) {
        newErrors.scheduledEnd =
          "End date is required when scheduling is enabled";
      }
      if (scheduledStart && scheduledEnd && scheduledStart >= scheduledEnd) {
        newErrors.scheduledEnd = "End date must be after start date";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handlers
  const handleAddCollection = useCallback(
    (collection: Collection) => {
      setSelectedCollections([...selectedCollections, collection]);
    },
    [selectedCollections],
  );

  const handleRemoveCollection = useCallback(
    (collectionId: string) => {
      setSelectedCollections(
        selectedCollections.filter((c) => c.id !== collectionId),
      );
    },
    [selectedCollections],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchValue("");
  }, []);

  const handleSave = (): void => {
    if (!validateForm()) return;

    const formData = new FormData();
    formData.append("actionType", isEditing ? "updateRule" : "createRule");

    if (isEditing && rule) {
      formData.append("ruleId", rule.id);
    }

    formData.append("name", name.trim());
    formData.append("description", description.trim());
    formData.append("mode", currentMode);
    formData.append("priority", priority);
    formData.append("active", active.toString());
    formData.append("isScheduled", isScheduled.toString());

    if (isScheduled) {
      formData.append("scheduledStart", scheduledStart);
      formData.append("scheduledEnd", scheduledEnd);
    }

    formData.append("excludedCollections", JSON.stringify(selectedCollections));

    onSave(formData);
  };

  // Show plan limit warning for new rules
  if (isAtLimit) {
    return (
      <Card>
        <BlockStack gap="400">
          <Banner tone="warning">
            <p>
              <strong>Plan Limit Reached</strong>
              <br />
              You&apos;ve reached the maximum number of rules ({planLimit?.max})
              for your {planLimit?.planName} plan. Upgrade to create more rules.
            </p>
          </Banner>
          <InlineStack gap="300" align="end">
            <Button onClick={onCancel}>Close</Button>
            <Button variant="primary">Upgrade Plan</Button>
          </InlineStack>
        </BlockStack>
      </Card>
    );
  }

  return (
    <Card>
      <BlockStack gap="500">
        <Text variant="headingLg" as="h2">
          {isEditing ? `Edit Rule: ${rule?.name}` : "Create New Rule"}
        </Text>

        <Divider />

        {/* Basic Information */}
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            Basic Information
          </Text>

          <TextField
            label="Rule Name"
            value={name}
            onChange={setName}
            placeholder="e.g., Exclude Sale Items"
            error={errors.name}
            autoComplete="off"
            requiredIndicator
          />

          <TextField
            label="Description (Optional)"
            value={description}
            onChange={setDescription}
            placeholder="Brief description of what this rule does..."
            multiline={2}
            autoComplete="off"
          />

          <InlineStack gap="400" align="start">
            <div style={{ flex: 1 }}>
              <Select
                label="Priority"
                value={priority}
                onChange={setPriority}
                options={priorityOptions}
                error={errors.priority}
                helpText="Lower numbers = higher priority. Rules with priority 0 run first."
              />
            </div>

            <div style={{ paddingTop: "1.5rem" }}>
              <Checkbox
                label="Rule is active"
                checked={active}
                onChange={setActive}
                helpText="Inactive rules are saved but not applied"
              />
            </div>
          </InlineStack>
        </BlockStack>

        <Divider />

        {/* Application Mode */}
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            Application Mode
          </Text>

          <ChoiceList
            title=""
            choices={[
              {
                label: "Exclude Collections (Recommended)",
                value: "exclude",
                helpText:
                  "Apply discount to ALL collections except selected ones. New collections are auto-included.",
              },
              {
                label: "Include Collections (Default Shopify)",
                value: "include",
                helpText:
                  "Apply discount ONLY to selected collections. New collections must be added manually.",
              },
            ]}
            selected={selectedMode}
            onChange={setSelectedMode}
          />
        </BlockStack>

        <Divider />

        {/* Selected Collections */}
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h3">
              {isExcludeMode ? "Excluded Collections" : "Included Collections"}
            </Text>
            <Badge tone={isExcludeMode ? "critical" : "success"}>
              {`${selectedCollections.length.toString()} selected`}
            </Badge>
          </InlineStack>

          {selectedCollections.length > 0 ? (
            <InlineStack gap="200" wrap={true}>
              {selectedCollections.map((collection) => (
                <Tag
                  key={collection.id}
                  onRemove={() => handleRemoveCollection(collection.id)}
                >
                  {collection.title} ({collection.productsCount})
                </Tag>
              ))}
            </InlineStack>
          ) : (
            <Banner tone={isExcludeMode ? "info" : "warning"}>
              <p>
                {isExcludeMode
                  ? "No collections excluded. Discount will apply to ALL collections."
                  : "No collections selected. Discount will apply to NO collections."}
              </p>
            </Banner>
          )}

          {/* Collection Search & Selection */}
          <BlockStack gap="300">
            <TextField
              label={
                isExcludeMode
                  ? "Search collections to exclude"
                  : "Search collections to include"
              }
              value={searchValue}
              onChange={handleSearchChange}
              placeholder="Search..."
              autoComplete="off"
              clearButton
              onClearButtonClick={handleSearchClear}
            />

            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                border: "1px solid #e1e3e5",
                borderRadius: "8px",
              }}
            >
              <ResourceList
                resourceName={{
                  singular: "collection",
                  plural: "collections",
                }}
                items={filteredCollections}
                renderItem={(item: Collection) => {
                  const { id, title, productsCount } = item;

                  return (
                    <ResourceItem
                      id={id}
                      onClick={() => handleAddCollection(item)}
                      verticalAlignment="center"
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="semibold" as="h4">
                            {title}
                          </Text>
                          <Text variant="bodySm" tone="subdued" as="span">
                            {productsCount} products
                          </Text>
                        </BlockStack>
                        <Button size="slim">
                          {isExcludeMode ? "Exclude" : "Include"}
                        </Button>
                      </InlineStack>
                    </ResourceItem>
                  );
                }}
              />
            </div>
          </BlockStack>
        </BlockStack>

        <Divider />

        {/* Scheduling */}
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            Scheduling (Optional)
          </Text>

          <Checkbox
            label="Enable scheduling"
            checked={isScheduled}
            onChange={setIsScheduled}
            helpText="Schedule when this rule should be active"
          />

          {isScheduled && (
            <InlineStack gap="400" align="start">
              <div style={{ flex: 1 }}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={scheduledStart}
                  onChange={setScheduledStart}
                  error={errors.scheduledStart}
                  autoComplete="off"
                />
              </div>
              <div style={{ flex: 1 }}>
                <TextField
                  label="End Date"
                  type="date"
                  value={scheduledEnd}
                  onChange={setScheduledEnd}
                  error={errors.scheduledEnd}
                  autoComplete="off"
                />
              </div>
            </InlineStack>
          )}
        </BlockStack>

        <Divider />

        {/* Actions */}
        <InlineStack gap="300" align="end">
          <Button onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isLoading}
            disabled={!name.trim()}
          >
            {isEditing ? "Update Rule" : "Create Rule"}
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
