import { ActivityIndicator, View } from "react-native";
import { APP_THEME } from "../../src/utils/constants";

export default function QuickActionsPlaceholder() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: APP_THEME.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color={APP_THEME.primary} />
    </View>
  );
}
