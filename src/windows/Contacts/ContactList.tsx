import React, { useLayoutEffect, useState } from "react";
import { StyleSheet, StatusBar, View } from "react-native";
import { Icon, Text, Header, Item, Button } from "native-base";
import { StackNavigationProp } from "@react-navigation/stack";
import Color from "color";

import { ContactsStackParamList } from "./index";
import { useStoreState, useStoreActions } from "../../state/store";
import Container from "../../components/Container";
import { blixtTheme } from "../../native-base-theme/variables/commonColor";
import { NavigationButton } from "../../components/NavigationButton";
import Content from "../../components/Content";
import usePromptLightningAddress from "../../hooks/usePromptLightningAddress";
import { Alert } from "../../utils/alert";
import { Chain } from "../../utils/build";
import Contact from "./Contact";
import { IContact } from "../../storage/database/contact";
import Input from "../../components/Input";

import { useTranslation } from "react-i18next";
import { namespaces } from "../../i18n/i18n.constants";

interface IContactListProps {
  navigation: StackNavigationProp<ContactsStackParamList, "ContactList">;
}
export default function ContactList({ navigation }: IContactListProps) {
  const t = useTranslation(namespaces.contacts.contactList).t;
  const [searchText, setSearchText] = useState("");
  const contacts = useStoreState((store) => store.contacts.contacts);
  const getContacts = useStoreActions((store) => store.contacts.getContacts);
  const syncContact = useStoreActions((store) => store.contacts.syncContact);
  const deleteContact = useStoreActions((store) => store.contacts.deleteContact);
  const clearLnUrl = useStoreActions((store) => store.lnUrl.clear);
  const promptLightningAddress = usePromptLightningAddress();
  const getContactByLightningAddress = useStoreState((store) => store.contacts.getContactByLightningAddress);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<IContact[]>([]);
  const resolveLightningAddress = useStoreActions((store) => store.lnUrl.resolveLightningAddress);
  const resolveMultiLightningAddress = useStoreActions((store) => store.lnUrl.resolveMultiLightningAddress);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: t("layout.title", { ns:namespaces.contacts.contactList }),
      headerBackTitle: t("buttons.back", { ns:namespaces.common }),
      headerShown: true,
      headerRight: () => {
        return (
          <NavigationButton onPress={addLightningAddress}>
            <Icon type="AntDesign" name="adduser" style={{ fontSize: 22 }} />
          </NavigationButton>
        )
      }
    });
    getContacts();
  }, [navigation]);

  const addLightningAddress = async () => {
    const promptRes = await promptLightningAddress();
    if (promptRes[0] && promptRes[1] && promptRes.length === 3) { // multiple addresses
      let addresses = promptRes[1].split(",").map((a) => a.trim());
      addresses = addresses.filter((a) => !getContactByLightningAddress(a))
      await Promise.all(addresses.map((a) => addContactByLightningAddress(a)));
    } else { // single address
      const [result, lightningAddress] = promptRes;
      if (result && lightningAddress) {
        if (getContactByLightningAddress(lightningAddress)) {
          Alert.alert("", `${lightningAddress} ${t("lightningAddressAlreadyExists")}.`);
          return;
        }
        await addContactByLightningAddress(lightningAddress);
      }
    }

    clearLnUrl();
  };

  const addContactByLightningAddress = async (lightningAddress: string) => {
    const domain = lightningAddress.split("@")[1] ?? "";
    await syncContact({
      type: "PERSON",
      domain,
      lnUrlPay: null,
      lnUrlWithdraw: null,
      lightningAddress: lightningAddress!,
      lud16IdentifierMimeType: "text/identifier",
      note: "",
    });
  };

  const filteredContacts = contacts.filter((contact) => {
    if (searchText.length > 0) {
      const search = searchText.toUpperCase();
      return (
        contact.lightningAddress?.toUpperCase().includes(search) ||
        contact.domain.toUpperCase().includes(search) ||
        contact.note.toUpperCase().includes(search)
      );
    }
    return true;
  });

  const sortedContacts = filteredContacts.sort((a, b) => {
    const aCmp = a.lightningAddress ?? a.domain;
    const bCmp = b.lightningAddress ?? b.domain

    if (aCmp < bCmp) {
      return -1;
    }
    if (aCmp > bCmp) {
      return 1;
    }
    return 0;
  });

  const onContactSelectionChange = (contact: IContact, selected: boolean) => {
    if (selected) {
      setSelectedContacts([...selectedContacts, contact]);
    } else {
      setSelectedContacts(selectedContacts.filter((c) => c.id !== contact.id));
    }
  };

  const onBulkDeletePress = () => {
    Alert.alert(
      t("contact.deleteContact.title"),
      t("contact.deleteContact.msgMulti"),
      [
        {
          text: t("buttons.no",{ns:namespaces.common}),
        },
        {
          text: t("buttons.yes",{ns:namespaces.common}),
          onPress: async () => {
            for (const contact of selectedContacts) {
              await deleteContact(contact.id!);
            }
            setSelectedContacts([]);
            setIsEditing(false);
          },
        },
      ]
    );
  };

  const onBulkSendPress = async () => {
    if (selectedContacts.length === 0) {
      return;
    }

    const multi = selectedContacts.length > 1;

    if (multi) {
      const multiAddresses = selectedContacts.map(c => c.lightningAddress);
      if (await resolveMultiLightningAddress(multiAddresses as string[])) {
        navigation.navigate("LNURL", { screen: "PayRequestMulti" });
      }
    } else {
      if (await resolveLightningAddress(selectedContacts[0].lightningAddress!)) {
        navigation.navigate("LNURL", { screen: "PayRequest" });
      }
    }
  };

  return (
    <Container>
      <Header iosBarStyle="light-content" searchBar rounded style={style.searchHeader}>
        <NavigationButton onPress={() => setIsEditing(!isEditing)}>
          <Icon type="AntDesign" name="edit" style={{ fontSize: 22, marginTop: 16 }} />
        </NavigationButton>
        <Item rounded style={{ height: 35, marginLeft: 12 }}>
          <Input
            style={{ marginLeft: 8, marginTop: -2.5, borderRadius: 8, color: blixtTheme.dark }}
            placeholder={t("generic.search", { ns: namespaces.common })}
            onChangeText={setSearchText}
            autoCorrect={false}
            enableFocusRing={false} // macOS prop
          />
          <Icon name="ios-search" />
        </Item>
      </Header>
      <StatusBar
        barStyle="light-content"
        hidden={false}
        backgroundColor="transparent"
        animated={false}
        translucent={true}
      />
      <Content>
        {contacts.length === 0 &&
          <Text style={{ textAlign: "center", marginTop: 20 }}>
            {t("layout.nothingHereYet")+"\n\n"+t("layout.whyNotAdd")+"\n"}
            <Text onPress={addLightningAddress} style={{color:blixtTheme.link}}>
              {t("layout.tappingHere")}
            </Text>?
          </Text>
        }
        {isEditing &&
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "bold" }}>
              {selectedContacts.length} {t("layout.selected")}
            </Text>
            <Button onPress={onBulkSendPress} small style={{marginLeft: "auto", marginRight: 5}} disabled={!selectedContacts.length}>
              <Text>{t("contact.send.title")}</Text>
            </Button>
            <Button onPress={onBulkDeletePress} small icon danger disabled={!selectedContacts.length}>
              <Icon type="AntDesign" name="delete" style={[{fontSize: 10, margin: 0, padding: 0 }]}/>
            </Button>
          </View>
        }
        {sortedContacts.map((contact) => (
          <Contact key={contact.id} contact={contact} selectable={isEditing} onSelectedChange={onContactSelectionChange} />
        ))}
      </Content>
    </Container>
  );
};

const style = StyleSheet.create({
  container: {
    padding: 12,
    paddingBottom: 25,
  },
  searchHeader: {
    backgroundColor: Chain === "mainnet" ? blixtTheme.primary : Color(blixtTheme.lightGray).darken(0.30).hex(),
    paddingTop: 0,
    borderBottomWidth: 0,
    marginHorizontal: 8,
    elevation: 0,
  },
});
