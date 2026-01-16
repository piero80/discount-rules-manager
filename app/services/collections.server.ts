interface Collection {
  id: string;
  title: string;
  handle: string;
}

interface ShopifyCollection {
  id: number;
  title?: string;
  handle?: string;
}

/**
 * Fetches all collections from Shopify
 */
export async function getCollections(session: {
  shop: string;
  accessToken: string;
}): Promise<Collection[]> {
  try {
    console.log("🔍 Fetching collections...");

    // Fetch collections via REST API
    const collectionsResponse = await fetch(
      `https://${session.shop}/admin/api/2023-10/collections.json`,
      {
        headers: {
          "X-Shopify-Access-Token": session.accessToken!,
          "Content-Type": "application/json",
        },
      },
    );

    const collectionsData = await collectionsResponse.json();

    if (!collectionsResponse.ok) {
      throw new Error(
        `Collections API Error: ${collectionsResponse.status} ${collectionsResponse.statusText}`,
      );
    }

    const collections = collectionsData.collections || [];
    console.log("📁 Found collections:", collections.length);

    // Transform to our expected format
    return collections.map((collection: ShopifyCollection) => ({
      id: collection.id.toString(),
      title: collection.title || "Untitled Collection",
      handle: collection.handle || "",
    }));
  } catch (error) {
    console.error("Error fetching collections:", error);
    return [];
  }
}
