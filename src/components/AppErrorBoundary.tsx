import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { APP_THEME } from "../utils/constants";
import { logCrash } from "../utils/crashLogger";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Keep a lightweight fallback to avoid white screen in production.
    console.error("Unhandled app error", error);
    void logCrash("error_boundary", error, true);
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.meta}>Please retry. If issue continues, restart app.</Text>
          <TouchableOpacity style={styles.btn} onPress={this.retry}>
            <Text style={styles.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: APP_THEME.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  title: {
    color: APP_THEME.text,
    fontSize: 20,
    fontWeight: "800",
  },
  meta: {
    color: APP_THEME.muted,
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  btn: {
    marginTop: 14,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  btnText: {
    color: APP_THEME.bg,
    fontWeight: "800",
    fontSize: 13,
  },
});
