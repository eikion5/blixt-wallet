import { Alert } from "../utils/alert";
import { useStoreActions } from "../state/store";
import { useNavigation } from "@react-navigation/core";

export default function usePromptLightningAddress() {
  const resolveLightningAddress = useStoreActions((store) => store.lnUrl.resolveLightningAddress);
  const resolveMultiLightningAddress = useStoreActions((store) => store.lnUrl.resolveMultiLightningAddress);
  const navigation = useNavigation();

  return () => new Promise<[boolean, string?, boolean?]>((resolve, reject) => {
    Alert.prompt(
      "Lightning Address", // TODO: translate
      "Enter Lightning Address\n(user@domain.com)\n\nOr multiple addresses separated by commas\n(alice@domain.com,bob@domain.com)",
      [{
        text: "Cancel",
        style: "cancel",
        onPress: () => resolve([false]),
      }, {
        text: "Ok",
        onPress: async (text) => {
          try {
            const lightningAddress = (text ?? "").trim();
            const multiAddresses = lightningAddress.split(",").map((address) => address.trim());

            navigation.navigate("LoadingModal");

            if (multiAddresses.length > 1) {
              if (await resolveMultiLightningAddress(multiAddresses)) {
                navigation.goBack();
                resolve([true, multiAddresses.join(","), true]); // last param is true to indicate multi-address
              }
            } else {
              if (await resolveLightningAddress(lightningAddress)) {
                navigation.goBack();
                resolve([true, lightningAddress]);
              }
            }
          } catch (error) {
            navigation.goBack();
            Alert.alert("Cannot send to Lightning Address", error.message);
            resolve([false]);
          }
        },
      }],
      "plain-text",
      undefined,
      "email-address",
    );
  });
}
