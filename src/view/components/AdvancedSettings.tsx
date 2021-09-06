import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  ExpandedIndex,
  Flex,
  Heading,
  HStack,
  Input,
  Kbd,
  Link,
  Spacer,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
} from "@chakra-ui/react";
import React, { useCallback, useEffect, useState } from "react";
import { RemoteStore, useRemoteValue } from "../../ipc";
import { KeyBindControl } from "./settings/key-bind/KeyBindControl";
import { AngleControl } from "./settings/angle/AngleControl";
import { Card } from "./general/Card";
import {
  defaultKeyMapping,
  defaultLeftJoystickStrafingAngles,
  defaultToggleAccelerator,
} from "../../native/types";
import { Key } from "ts-keycode-enum";
import { InfoTooltip } from "./general/InfoTooltip";
import {
  AcceleratorModifiers,
  isKeycodeValidForAccelerator,
  PrettyAcceleratorName,
} from "../../accelerator";

const minTabHeight = "240px";
const strafeAngleRange: [number, number] = [45, 71];

function keybindDisplay(keyOne: number | undefined, fallback: string) {
  return <Kbd>{keyOne === undefined ? fallback : Key[keyOne]}</Kbd>;
}

function AppSettingsTab() {
  const [toggleAccelerator, setToggleAccelerator] = useRemoteValue(
    "enabledToggleAccelerator",
    defaultToggleAccelerator
  );
  const toggleAcceleratorPretty = PrettyAcceleratorName(
    "display",
    toggleAccelerator
  );

  function resetToDefault() {
    setToggleAccelerator(defaultToggleAccelerator);
  }

  const [isEditing, setIsEditing] = useState(false);
  const [acceleratorEdit, setAcceleratorEdit] = useState<Key[]>([]);
  let acceleratorEditPrettyValue = PrettyAcceleratorName(
    "display",
    acceleratorEdit
  );
  if (acceleratorEditPrettyValue.length > 0)
    acceleratorEditPrettyValue += "+...";

  function completeAcceleratorEdit() {
    setIsEditing(false);

    // Use the current value callback of the set function to get the latest value
    setAcceleratorEdit((finalValue) => {
      console.log(finalValue);
      setToggleAccelerator(finalValue);
      return [];
    });
  }

  function requestEdit() {
    setIsEditing(true);

    function keyupListener(event: KeyboardEvent) {
      setAcceleratorEdit((current) =>
        current.filter((k) => k !== event.keyCode)
      );
    }

    function keydownListener(event: KeyboardEvent) {
      if (isKeycodeValidForAccelerator(event.keyCode)) {
        setAcceleratorEdit((current) => [...current, event.keyCode]);
        // If the keycode isn't present in the accelerator modifiers then this is the final part of the accelerator
        if (!AcceleratorModifiers.includes(event.keyCode)) {
          window.removeEventListener("keydown", keydownListener);
          window.removeEventListener("keyup", keyupListener);
          completeAcceleratorEdit();
        }
      } else {
        console.debug(
          `Keycode ${event.code}:${event.keyCode} is not valid for an accelerator`
        );
      }
    }

    window.addEventListener("keydown", keydownListener);
    window.addEventListener("keyup", keyupListener);
  }
  // useEffect(() => {
  //   if (editingState) {
  //     window.addEventListener("keydown", listener, { once: true });

  //     // register blur event so we cancel the bind process when the tool gets out of focus
  //     window.addEventListener(
  //       "blur",
  //       () => {
  //         // unsubscribe to keydown event since bind process is already canceled by the blur event
  //         window.removeEventListener("keydown", listener);
  //         setEditingState(undefined);
  //       },
  //       {
  //         once: true,
  //       }
  //     );
  //   }

  //   return () => {
  //     window.removeEventListener("keydown", listener);
  //   };
  // }, [editingState]);

  return (
    <VStack align="baseline" spacing="2" height="100%" position="relative">
      <HStack w="100%">
        <Text w="fit-content" whiteSpace="nowrap">
          Toggle Hotkey
        </Text>
        <InfoTooltip>
          <Text pt="1" fontSize="sm">
            This allows you to configure the hotkey that toggles if Double
            Movement is active. Just click on the box and press the key combo
            you'd like to use
          </Text>
        </InfoTooltip>
        <Input
          placeholder={isEditing ? "Start pressing a key" : "Click to set"}
          cursor="pointer"
          value={
            !isEditing ? toggleAcceleratorPretty : acceleratorEditPrettyValue
          }
          onClick={() => {
            requestEdit();
          }}
          isReadOnly={true}
          size="sm"
        />
      </HStack>

      <Link
        position="absolute"
        bottom="0px"
        as={Text}
        variant="plink"
        fontSize="sm"
        onClick={resetToDefault}
      >
        Reset to Wooting recommended
      </Link>
    </VStack>
  );
}

function KeyMappingTab() {
  const [keyMapping, setKeyMapping] = useRemoteValue(
    "keyMapping",
    defaultKeyMapping
  );

  function setDefaultBindSettings() {
    RemoteStore.resetBindSettings();
  }

  return (
    <VStack align="baseline" spacing="2" height="100%" position="relative">
      <KeyBindControl keyMapping={keyMapping} setKeyMapping={setKeyMapping} />

      <Link
        position="absolute"
        bottom="0px"
        as={Text}
        variant="plink"
        fontSize="sm"
        onClick={setDefaultBindSettings}
      >
        Reset keybinds to Wooting recommended
      </Link>
    </VStack>
  );
}

function StrafeAngleControl() {
  const [keyMapping, _] = useRemoteValue("keyMapping", defaultKeyMapping);

  function setDefaultStrafingSettings() {
    RemoteStore.resetStrafingSettings();
  }

  const [angleConfig, setAngleConfig] = useRemoteValue(
    "leftJoystickStrafingAngles",
    defaultLeftJoystickStrafingAngles
  );

  const isAdvancedStrafeOn = angleConfig.useLeftRightAngle;

  const toggleEnabled = useCallback(() => {
    const value = !angleConfig.useLeftRightAngle;
    setAngleConfig({ ...angleConfig, useLeftRightAngle: value });
  }, [angleConfig]);

  const setDiagonalAngle = useCallback(
    (angle) => setAngleConfig({ ...angleConfig, upDiagonalAngle: angle }),
    [angleConfig]
  );

  const setLeftRightAngle = useCallback(
    (angle) => setAngleConfig({ ...angleConfig, leftRightAngle: angle }),
    [angleConfig]
  );

  return (
    <VStack align="baseline" spacing="2" height="100%" position="relative">
      <Flex>
        <Heading>Strafe Angle</Heading>
        <InfoTooltip ml="7px" mt="2px">
          <Text pt="1" fontSize="sm">
            This option allows you to adjust the angle you will strafe by
            pressing <Kbd>Left</Kbd>/<Kbd>Right</Kbd> at the same time as{" "}
            <Kbd>Forward</Kbd> (e.g.{" "}
            {keybindDisplay(keyMapping.leftJoystick.up, "W")}+
            {keybindDisplay(keyMapping.leftJoystick.right, "D")})
          </Text>
        </InfoTooltip>
      </Flex>
      <AngleControl
        angle={angleConfig.upDiagonalAngle}
        setAngle={setDiagonalAngle}
        min={strafeAngleRange[0]}
        max={strafeAngleRange[1]}
      />

      <Flex
        width="100%"
        direction="column"
        onClick={toggleEnabled}
        cursor="pointer"
        pt="6"
      >
        <Flex>
          <Flex>
            <Heading>Enable Single Key Strafing</Heading>
            <InfoTooltip ml="7px" mt="2px">
              <Text pt="1" fontSize="sm">
                This option allows you to adjust the angle you will strafe by
                pressing just one of the <Kbd>Left</Kbd>/<Kbd>Right</Kbd> keys
                (e.g. {keybindDisplay(keyMapping.leftJoystick.right, "D")})
              </Text>
            </InfoTooltip>
          </Flex>
          <Spacer />
          {/* Render switch as Div so onClick doesn't get triggered twice: https://github.com/chakra-ui/chakra-ui/issues/2854 */}
          <Switch
            colorScheme="accent"
            isChecked={isAdvancedStrafeOn}
            as="div"
          ></Switch>
        </Flex>
      </Flex>
      {isAdvancedStrafeOn && (
        <AngleControl
          angle={angleConfig.leftRightAngle}
          setAngle={setLeftRightAngle}
          min={15}
          max={90}
        />
      )}
      <Link
        position="absolute"
        bottom="0px"
        as={Text}
        variant="plink"
        fontSize="sm"
        onClick={setDefaultStrafingSettings}
      >
        Reset settings to Wooting recommended
      </Link>
    </VStack>
  );
}

export function AdvancedSettingsCard(props: {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}) {
  function updateWindowSize(index: ExpandedIndex) {
    props.setIsExpanded(index == 0);
  }

  return (
    <Card p="2">
      <Accordion allowToggle={true} onChange={updateWindowSize}>
        <AccordionItem border="none">
          <AccordionButton _hover={{ bg: "none" }}>
            <Heading flex="1" textAlign="left">
              Advanced mode
            </Heading>
            <AccordionIcon />
          </AccordionButton>

          <AccordionPanel pb={4}>
            <Tabs variant="enclosed" colorScheme="accent">
              <TabList>
                <Tab mr={3}>Keybinds</Tab>
                <Tab>Strafing</Tab>
                <Tab>App</Tab>
              </TabList>

              <TabPanels height={minTabHeight}>
                <TabPanel height="100%" px="4" pt="4" pb="0">
                  <KeyMappingTab />
                </TabPanel>

                <TabPanel height="100%" px="4" pt="4" pb="0">
                  <StrafeAngleControl />
                </TabPanel>

                <TabPanel height="100%" px="4" pt="4" pb="0">
                  <AppSettingsTab />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
