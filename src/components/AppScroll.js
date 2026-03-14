import React from "react";
import {
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";

/**
 * AppScroll
 * - Common scroll wrapper
 * - Pull to refresh support
 * - Same UX everywhere
 */
export default function AppScroll({
  children,
  refreshing = false,
  onRefresh,
  style,
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.container, style]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#38BDF8"
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 30,
  },
});